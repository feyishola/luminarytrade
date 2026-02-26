import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IMiddleware } from '../interfaces/middleware.interface';

@Injectable()
export class ErrorHandlingMiddleware implements NestMiddleware, IMiddleware {
  name = 'ErrorHandlingMiddleware';

  use(req: Request, res: Response, next: NextFunction) {
    next();
  }

  error(err: any, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) return next(err);
    const status = typeof err?.status === 'number' ? err.status : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = err?.message || 'Internal server error';
    res.status(status).json({
      success: false,
      error: {
        code: err?.code || 'GEN_001',
        message,
        timestamp: new Date().toISOString(),
        path: req.url,
      },
    });
  }
}
