import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'dev_secret_key',
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      publicKey: payload.publicKey,
      email: payload.email,
      roles: payload.roles ?? [],
      tier: payload.tier ?? 'free',
    };
  }
}
