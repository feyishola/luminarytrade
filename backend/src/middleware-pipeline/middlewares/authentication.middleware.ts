import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { IMiddleware } from '../interfaces/middleware.interface';

@Injectable()
export class AuthenticationMiddleware implements NestMiddleware, IMiddleware {
  name = 'AuthenticationMiddleware';
  constructor(private readonly jwt: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const header = req.headers['authorization'] || '';
    const token = Array.isArray(header) ? header[0] : header;
    if (token && token.startsWith('Bearer ')) {
      const jwtToken = token.substring(7);
      try {
        const payload = this.jwt.verify(jwtToken) as any;
        (req as any).user = {
          id: payload.sub,
          email: payload.email ?? null,
          publicKey: payload.publicKey ?? null,
          roles: payload.roles ?? ['user'],
          tier: payload.tier ?? 'free',
        };
      } catch {}
    }
    next();
  }
}
