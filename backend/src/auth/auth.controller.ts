import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordLoginDto } from './dto/password-login.dto';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthGuard } from '@nestjs/passport';
import { RateLimitByEndpoint } from '../rate-limiting/decorators/rate-limit.decorator';
import { CsrfGuard } from './guards/csrf.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @RateLimitByEndpoint('auth')
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Request() req) {
    return this.authService.signup(dto, this.getMeta(req));
  }

  @RateLimitByEndpoint('auth')
  @Post('login')
  async login(
    @Body() loginDto: PasswordLoginDto,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.loginWithEmail(loginDto, this.getMeta(req));
    this.setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);
    return {
      accessToken: tokens.accessToken,
      csrfToken: tokens.csrfToken,
      session: tokens.session,
      sessionExpiresAt: tokens.sessionExpiresAt,
      user: tokens.user,
    };
  }

  @RateLimitByEndpoint('auth')
  @Post('wallet/login')
  async walletLogin(
    @Body() loginDto: LoginDto,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.loginWithWallet(loginDto, this.getMeta(req));
    this.setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);
    return {
      accessToken: tokens.accessToken,
      csrfToken: tokens.csrfToken,
      session: tokens.session,
      sessionExpiresAt: tokens.sessionExpiresAt,
      user: tokens.user,
    };
  }

  @RateLimitByEndpoint('auth')
  @Post('social/login')
  async socialLogin(
    @Body() loginDto: SocialLoginDto,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.loginWithSocial(loginDto, this.getMeta(req));
    this.setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);
    return {
      accessToken: tokens.accessToken,
      csrfToken: tokens.csrfToken,
      session: tokens.session,
      sessionExpiresAt: tokens.sessionExpiresAt,
      user: tokens.user,
    };
  }

  @RateLimitByEndpoint('auth')
  @UseGuards(CsrfGuard)
  @Post('refresh')
  async refresh(@Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    const tokens = await this.authService.refreshSession(refreshToken, this.getMeta(req));
    this.setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);
    return {
      accessToken: tokens.accessToken,
      csrfToken: tokens.csrfToken,
      session: tokens.session,
      sessionExpiresAt: tokens.sessionExpiresAt,
      user: tokens.user,
    };
  }

  @RateLimitByEndpoint('auth')
  @UseGuards(CsrfGuard)
  @Post('logout')
  async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    await this.authService.logout(refreshToken, this.getMeta(req));
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @RateLimitByEndpoint('auth')
  @UseGuards(CsrfGuard)
  @Post('logout-all')
  async logoutAll(@Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    const meta = this.getMeta(req);
    if (refreshToken) {
      try {
        const refreshed = await this.authService.refreshSession(refreshToken, meta);
        await this.authService.logoutAll(refreshed.user.id, meta);
      } catch {
        // ignore refresh failures so we can still clear cookies
      }
    }
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @RateLimitByEndpoint('auth')
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { ok: true };
  }

  @RateLimitByEndpoint('auth')
  @Get('csrf')
  async csrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = await this.authService.createCsrfToken();
    this.setCsrfCookie(res, csrfToken);
    return { csrfToken };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('sessions')
  async sessions(@Request() req) {
    return this.authService.listSessions(req.user.userId);
  }

  private getMeta(req: any) {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip;
    return {
      ipAddress: ipAddress || null,
      userAgent: req.headers['user-agent'] || null,
    };
  }

  private setAuthCookies(res: Response, refreshToken: string, csrfToken: string) {
    const isProd = process.env.NODE_ENV === 'production';
    const refreshDays = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);
    const maxAge = refreshDays * 24 * 60 * 60 * 1000;

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/auth',
      maxAge,
    });

    this.setCsrfCookie(res, csrfToken, maxAge);
  }

  private setCsrfCookie(res: Response, csrfToken: string, maxAge?: number) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('refresh_token', { path: '/auth' });
    res.clearCookie('csrf_token', { path: '/' });
  }
}
