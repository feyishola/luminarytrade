import { Test } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/user.service';
import { AuthAuditLogger } from '../login/audit-logger.service';
import { AdapterFactory } from '../../adapters/factory/adapter.factory';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import { UnauthorizedException } from '@nestjs/common';

const mockJwtService = {
  sign: jest.fn().mockReturnValue('access-token'),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_ACCESS_TTL') return '15m';
    if (key === 'REFRESH_TOKEN_TTL_DAYS') return '30';
    return undefined;
  }),
};

const mockUsersService = {
  findByEmail: jest.fn(),
  findByPublicKey: jest.fn(),
  findBySocial: jest.fn(),
  createEmailUser: jest.fn(),
  createWalletUser: jest.fn(),
  createSocialUser: jest.fn(),
  updateLastLogin: jest.fn(),
  markEmailVerified: jest.fn(),
  linkPublicKey: jest.fn(),
};

const mockAuditLogger = {
  log: jest.fn(),
};

const mockAdapterFactory = {
  executeWalletOperationWithProtection: jest.fn(),
};

describe('AuthService refresh session', () => {
  let authService: AuthService;
  let refreshRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    refreshRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthAuditLogger, useValue: mockAuditLogger },
        { provide: AdapterFactory, useValue: mockAdapterFactory },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
        { provide: getRepositoryToken(EmailVerificationToken), useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() } },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  it('rotates refresh token on refresh', async () => {
    const user = { id: 'user-1', roles: ['user'], tier: 'free', email: 'user@example.com', publicKey: null };
    const storedToken = {
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
      user,
      createdAt: new Date(),
      lastUsedAt: null,
    } as any;

    refreshRepo.findOne.mockResolvedValue(storedToken);
    refreshRepo.create.mockImplementation((data) => ({ ...data, id: 'token-2', createdAt: new Date() }));
    refreshRepo.save.mockImplementation(async (entity) => entity);

    const result = await authService.refreshSession('refresh-token', {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBeDefined();
    expect(refreshRepo.save).toHaveBeenCalled();
  });

  it('rejects revoked refresh token', async () => {
    const user = { id: 'user-1', roles: ['user'], tier: 'free', email: 'user@example.com', publicKey: null };
    refreshRepo.findOne.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: new Date(),
      user,
      createdAt: new Date(),
      lastUsedAt: null,
    } as any);
    refreshRepo.find.mockResolvedValue([]);

    await expect(
      authService.refreshSession('refresh-token', { ipAddress: null, userAgent: null }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
