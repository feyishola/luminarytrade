import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IMiddleware } from '../interfaces/middleware.interface';

@Injectable()
export class LoggingMiddleware implements NestMiddleware, IMiddleware {
  name = 'LoggingMiddleware';
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const traceId = (req as any).traceId;
    res.on('finish', () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      this.logger.log(`${method} ${url} ${status} ${ms}ms${traceId ? ' ' + traceId : ''}`);
    });
    next();
  }
}
