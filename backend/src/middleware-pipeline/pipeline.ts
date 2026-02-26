import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IMiddleware, ComposedMiddleware, ComposeOptions } from './interfaces/middleware.interface';

type Entry = {
  mw: IMiddleware;
  condition?: (req: Request) => boolean;
};

@Injectable()
export class MiddlewarePipeline {
  private entries: Entry[] = [];
  private composed: ComposedMiddleware | null = null;
  private initialized = false;

  register(mw: IMiddleware, condition?: (req: Request) => boolean) {
    this.entries.push({ mw, condition });
    this.composed = null;
    return this;
  }

  useWhen(condition: (req: Request) => boolean, mw: IMiddleware) {
    return this.register(mw, condition);
  }

  insertBefore(name: string, mw: IMiddleware) {
    const idx = this.entries.findIndex(e => e.mw.name === name);
    if (idx >= 0) {
      this.entries.splice(idx, 0, { mw });
    } else {
      this.entries.push({ mw });
    }
    this.composed = null;
    return this;
  }

  insertAfter(name: string, mw: IMiddleware) {
    const idx = this.entries.findIndex(e => e.mw.name === name);
    if (idx >= 0) {
      this.entries.splice(idx + 1, 0, { mw });
    } else {
      this.entries.push({ mw });
    }
    this.composed = null;
    return this;
  }

  remove(name: string) {
    this.entries = this.entries.filter(e => e.mw.name !== name);
    this.composed = null;
    return this;
  }

  reorder(names: string[]) {
    const map = new Map(this.entries.map(e => [e.mw.name, e] as const));
    const next: Entry[] = [];
    for (const n of names) {
      const e = map.get(n);
      if (e) next.push(e);
    }
    for (const e of this.entries) {
      if (!next.includes(e)) next.push(e);
    }
    this.entries = next;
    this.composed = null;
    return this;
  }

  compose(options?: ComposeOptions): IMiddleware {
    const self = this;
    const composedName = options?.name || 'ComposedMiddleware';
    return {
      name: composedName,
      use(req: Request, res: Response, next: NextFunction) {
        const chain = self.build();
        chain(req, res, next);
      }
    };
  }

  build(): ComposedMiddleware {
    if (this.composed) return this.composed;
    const chain = this.entries.slice();
    const list: Array<(req: Request, res: Response, next: NextFunction) => any> = [];
    const errors: Array<(err: any, req: Request, res: Response, next: NextFunction) => any> = [];
    for (const e of chain) {
      const fn = (req: Request, res: Response, next: NextFunction) => {
        if (e.condition && !e.condition(req)) return next();
        return e.mw.use(req, res, next);
      };
      list.push(fn);
      if (typeof e.mw.error === 'function') {
        errors.push(e.mw.error.bind(e.mw));
      }
    }
    const composed: ComposedMiddleware = (req, res, next) => {
      if (!this.initialized) this.initialized = true;
      let idx = 0;
      const dispatch = (i: number, err?: any) => {
        if (err) return runError(err, i);
        if (i >= list.length) return next();
        idx = i;
        try {
          list[i](req, res, (e?: any) => dispatch(i + 1, e));
        } catch (e) {
          dispatch(i + 1, e);
        }
      };
      const runError = (err: any, i: number) => {
        let eidx = 0;
        const invoke = (k: number) => {
          if (k >= errors.length) return next(err);
          try {
            errors[k](err, req, res, (e?: any) => {
              if (e) return next(e);
              invoke(k + 1);
            });
          } catch (e2) {
            next(e2);
          }
        };
        invoke(0);
      };
      dispatch(0);
    };
    this.composed = composed;
    return composed;
  }

  stats() {
    return {
      initialized: this.initialized,
      middlewareCount: this.entries.length,
      composedCount: this.entries.length,
    };
  }
}
