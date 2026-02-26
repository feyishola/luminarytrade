import { Request, Response, NextFunction } from 'express';

export type Next = (err?: any) => void;

export interface MiddlewareConfig {
  name?: string;
  enabled?: boolean;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface IMiddleware {
  name: string;
  use(req: Request, res: Response, next: Next): any;
  error?(err: any, req: Request, res: Response, next: Next): any;
  when?(req: Request): boolean;
  configure?(config: any): void;
}

export type ComposedMiddleware = (req: Request, res: Response, next: Next) => void;

export interface ComposeOptions {
  name?: string;
  enabled?: boolean;
}

export interface PipelineStats {
  initialized: boolean;
  middlewareCount: number;
  composedCount: number;
}
