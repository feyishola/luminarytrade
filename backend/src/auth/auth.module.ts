import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdaptersModule } from '../adapters/adapters.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { UsersService } from './users/user.service';
import { AuditLogModule } from '../audit/audit-log.module';
import { AuthAuditLogger } from './login/audit-logger.service';
import { CsrfGuard } from './guards/csrf.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    AdaptersModule,
    AuditLogModule,
    TypeOrmModule.forFeature([User, RefreshToken, EmailVerificationToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'dev_secret_key',
        signOptions: { expiresIn: configService.get<string>('JWT_ACCESS_TTL') || '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, UsersService, JwtStrategy, AuthAuditLogger, CsrfGuard],
  controllers: [AuthController],
  exports: [AuthService, UsersService],
})
export class AuthModule {}
