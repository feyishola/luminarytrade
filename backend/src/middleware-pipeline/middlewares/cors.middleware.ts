import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { IMiddleware } from '../interfaces/middleware.interface';

@Injectable()
export class CorsMiddleware implements NestMiddleware, IMiddleware {
  name = 'CorsMiddleware';
  private origins: string[] = ['http://localhost:3000'];

  constructor(private config: ConfigService) {
    const env = this.config.get<string>('CORS_ORIGIN');
    if (env) {
      this.origins = env.split(',').map(s => s.trim());
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin as string | undefined;
    if (origin && (this.origins.includes(origin) || this.origins.includes('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    next();
  }
}
