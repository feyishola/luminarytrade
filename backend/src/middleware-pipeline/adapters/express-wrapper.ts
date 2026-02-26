import { RequestHandler, ErrorRequestHandler } from 'express';
import { IMiddleware } from '../interfaces/middleware.interface';

export function wrap(name: string, handler: RequestHandler, errorHandler?: ErrorRequestHandler): IMiddleware {
  return {
    name,
    use: handler as any,
    error: errorHandler as any,
  };
}
