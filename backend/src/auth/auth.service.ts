import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { PasswordLoginDto } from './dto/password-login.dto';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { AdapterFactory } from '../adapters/factory/adapter.factory';
import { UsersService } from './users/user.service';
import { User } from './users/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { hashPassword, verifyPassword } from './utils/password';
import { generateCsrfToken, generateRefreshToken, hashToken } from './utils/tokens';
import { AuthAuditLogger } from './login/audit-logger.service';
import { AuditEventType } from '../audit/entities/audit-log.entity';

export interface AuthSession {
  id: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  revokedAt: Date | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  session: AuthSession;
  sessionExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly adapterFactory: AdapterFactory,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly auditLogger: AuthAuditLogger,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(EmailVerificationToken)
    private readonly emailTokenRepo: Repository<EmailVerificationToken>,
  ) {}

  private get accessTokenTtl(): string {
    return this.configService.get<string>('JWT_ACCESS_TTL') || '15m';
  }

  private get refreshTokenTtlDays(): number {
    const value = this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') || '30';
    return Number.parseInt(value, 10);
  }

  private get requireEmailVerification(): boolean {
    return this.configService.get<string>('REQUIRE_EMAIL_VERIFICATION') === 'true';
  }

  private get emailVerificationTtlHours(): number {
    const value = this.configService.get<string>('EMAIL_VERIFICATION_TTL_HOURS') || '24';
    return Number.parseInt(value, 10);
  }

  async signup(dto: SignupDto, meta: AuthRequestMeta) {
    const existing = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = hashPassword(dto.password);
    const user = await this.usersService.createEmailUser(dto.email.toLowerCase(), passwordHash);

    if (dto.publicKey) {
      const existingWallet = await this.usersService.findByPublicKey(dto.publicKey);
      if (existingWallet && existingWallet.id !== user.id) {
        throw new BadRequestException('Wallet already associated');
      }
      await this.usersService.linkPublicKey(user.id, dto.publicKey);
      user.publicKey = dto.publicKey;
    }

    const verificationToken = await this.createEmailVerificationToken(user.id);

    await this.auditLogger.log(AuditEventType.AUTH_SIGNUP, user, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const response = {
      user: this.toSafeUser(user),
      emailVerificationRequired: this.requireEmailVerification,
      verificationToken:
        this.configService.get<string>('NODE_ENV') === 'production'
          ? undefined
          : verificationToken,
    };

    return response;
  }

  async loginWithEmail(dto: PasswordLoginDto, meta: AuthRequestMeta): Promise<AuthTokens & { user: SafeUser }> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user || !user.passwordHash) {
      await this.auditLogger.log(AuditEventType.AUTH_LOGIN_FAILURE, user, {
        wallet: dto.email,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        reason: 'invalid_credentials',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      await this.auditLogger.log(AuditEventType.AUTH_LOGIN_FAILURE, user, {
        wallet: dto.email,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        reason: 'invalid_credentials',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.requireEmailVerification && !user.emailVerified) {
      throw new ForbiddenException('Email verification required');
    }

    await this.usersService.updateLastLogin(user.id);

    const tokens = await this.createSession(user, meta);

    await this.auditLogger.log(AuditEventType.AUTH_LOGIN_SUCCESS, user, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      method: 'password',
    });

    return { ...tokens, user: this.toSafeUser(user) };
  }

  async loginWithWallet(loginDto: LoginDto, meta: AuthRequestMeta): Promise<AuthTokens & { user: SafeUser }> {
    const walletUser = await this.validateWallet(loginDto);
    let user = await this.usersService.findByPublicKey(walletUser.publicKey);

    if (!user) {
      user = await this.usersService.createWalletUser(walletUser.publicKey);
    }

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.createSession(user, meta);

    await this.auditLogger.log(AuditEventType.AUTH_LOGIN_SUCCESS, user, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      method: 'wallet',
    });

    return { ...tokens, user: this.toSafeUser(user) };
  }

  async loginWithSocial(dto: SocialLoginDto, meta: AuthRequestMeta): Promise<AuthTokens & { user: SafeUser }> {
    if (!dto.token || dto.token.length < 8) {
      throw new UnauthorizedException('Invalid social token');
    }

    const provider = dto.provider.toLowerCase();
    let user = await this.usersService.findBySocial(provider, dto.token);

    if (!user) {
      user = await this.usersService.createSocialUser(provider, dto.token, dto.email);
    }

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.createSession(user, meta);

    await this.auditLogger.log(AuditEventType.AUTH_LOGIN_SUCCESS, user, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      method: `social:${provider}`,
    });

    return { ...tokens, user: this.toSafeUser(user) };
  }

  async refreshSession(
    refreshToken: string,
    meta: AuthRequestMeta,
  ): Promise<AuthTokens & { user: SafeUser }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    if (stored.revokedAt) {
      await this.revokeAllTokensForUser(stored.userId, 'reuse_detected');
      await this.auditLogger.log(AuditEventType.AUTH_TOKEN_REVOKED, stored.user, {
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        reason: 'reuse_detected',
      });
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.revokeToken(stored, 'expired');
      throw new UnauthorizedException('Refresh token expired');
    }

    const newTokens = await this.rotateRefreshToken(stored, meta);

    await this.auditLogger.log(AuditEventType.AUTH_REFRESH, stored.user, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ...newTokens, user: this.toSafeUser(stored.user) };
  }

  async logout(refreshToken: string, meta: AuthRequestMeta): Promise<void> {
    if (!refreshToken) return;

    const tokenHash = hashToken(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash }, relations: ['user'] });
    if (!stored) return;

    await this.revokeToken(stored, 'logout');

    await this.auditLogger.log(AuditEventType.AUTH_LOGOUT, stored.user, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async logoutAll(userId: string, meta: AuthRequestMeta): Promise<void> {
    await this.revokeAllTokensForUser(userId, 'logout_all');
    await this.auditLogger.log(AuditEventType.AUTH_LOGOUT, { id: userId } as User, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      reason: 'logout_all',
    });
  }

  async listSessions(userId: string): Promise<AuthSession[]> {
    const tokens = await this.refreshTokenRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return tokens.map((token) => this.toSession(token));
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const stored = await this.emailTokenRepo.findOne({ where: { tokenHash } });
    if (!stored || stored.consumedAt) {
      throw new BadRequestException('Verification token invalid');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Verification token expired');
    }

    stored.consumedAt = new Date();
    await this.emailTokenRepo.save(stored);
    await this.usersService.markEmailVerified(stored.userId);

    await this.auditLogger.log(AuditEventType.AUTH_EMAIL_VERIFIED, { id: stored.userId } as User);
  }

  async createCsrfToken(): Promise<string> {
    return generateCsrfToken();
  }

  private async validateWallet(loginDto: LoginDto) {
    const { publicKey, message, signature } = loginDto;

    try {
      const isValid = await this.adapterFactory.executeWalletOperationWithProtection(
        async (walletAdapter) => {
          if (!walletAdapter.validateAddress(publicKey)) {
            throw new UnauthorizedException('Invalid wallet address format');
          }

          return await walletAdapter.verifySignature(publicKey, message, signature);
        },
      );

      if (!isValid) {
        this.logger.warn(`Invalid signature provided by wallet: ${publicKey}`);
        throw new UnauthorizedException('Invalid signature');
      }

      this.logger.log(`Wallet authenticated successfully: ${publicKey}`);
      return { publicKey };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Authentication failed: ${error.message}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private signAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      publicKey: user.publicKey,
      email: user.email,
      roles: user.roles ?? ['user'],
      tier: user.tier ?? 'free',
    };

    return this.jwtService.sign(payload, { expiresIn: this.accessTokenTtl });
  }

  private async createSession(user: User, meta: AuthRequestMeta): Promise<AuthTokens> {
    const refreshToken = generateRefreshToken();
    const csrfToken = generateCsrfToken();
    const now = new Date();
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    const session = this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      lastUsedAt: now,
    });

    const saved = await this.refreshTokenRepo.save(session);

    return {
      accessToken: this.signAccessToken(user),
      refreshToken,
      csrfToken,
      session: this.toSession(saved),
      sessionExpiresAt: expiresAt,
    };
  }

  private async rotateRefreshToken(
    stored: RefreshToken,
    meta: AuthRequestMeta,
  ): Promise<AuthTokens> {
    const now = new Date();
    const newRefreshToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    const newToken = this.refreshTokenRepo.create({
      userId: stored.userId,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: newExpiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      lastUsedAt: now,
    });

    const savedNew = await this.refreshTokenRepo.save(newToken);

    stored.revokedAt = now;
    stored.replacedByTokenId = savedNew.id;
    stored.lastUsedAt = now;
    await this.refreshTokenRepo.save(stored);

    return {
      accessToken: this.signAccessToken(stored.user),
      refreshToken: newRefreshToken,
      csrfToken: generateCsrfToken(),
      session: this.toSession(savedNew),
      sessionExpiresAt: newExpiresAt,
    };
  }

  private async revokeToken(token: RefreshToken, reason?: string): Promise<void> {
    if (token.revokedAt) return;
    token.revokedAt = new Date();
    await this.refreshTokenRepo.save(token);

    await this.auditLogger.log(AuditEventType.AUTH_TOKEN_REVOKED, token.user ?? null, {
      reason,
    });
  }

  private async revokeAllTokensForUser(userId: string, reason?: string): Promise<void> {
    const tokens = await this.refreshTokenRepo.find({ where: { userId } });
    const now = new Date();

    for (const token of tokens) {
      if (!token.revokedAt) {
        token.revokedAt = now;
      }
    }

    if (tokens.length) {
      await this.refreshTokenRepo.save(tokens);
    }

    await this.auditLogger.log(AuditEventType.AUTH_TOKEN_REVOKED, { id: userId } as User, {
      reason,
    });
  }

  private async createEmailVerificationToken(userId: string): Promise<string> {
    const token = generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.emailVerificationTtlHours * 60 * 60 * 1000);
    const entity = this.emailTokenRepo.create({
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    });
    await this.emailTokenRepo.save(entity);
    return token;
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      publicKey: user.publicKey,
      roles: user.roles ?? ['user'],
      tier: user.tier ?? 'free',
      emailVerified: user.emailVerified,
    };
  }

  private toSession(token: RefreshToken): AuthSession {
    return {
      id: token.id,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
      expiresAt: token.expiresAt,
      ipAddress: token.ipAddress,
      userAgent: token.userAgent,
      revokedAt: token.revokedAt,
    };
  }
}

export interface AuthRequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SafeUser {
  id: string;
  email: string | null;
  publicKey: string | null;
  roles: string[];
  tier: string;
  emailVerified: boolean;
}
