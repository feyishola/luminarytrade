import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IMiddleware } from '../interfaces/middleware.interface';

@Injectable()
export class ValidationMiddleware implements NestMiddleware, IMiddleware {
  name = 'ValidationMiddleware';

  use(req: Request, res: Response, next: NextFunction) {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const ct = (req.headers['content-type'] || '').toString().toLowerCase();
      if (ct && !ct.includes('application/json')) {
        return next(new BadRequestException('Unsupported content type'));
      }
    }
    next();
  }
}
