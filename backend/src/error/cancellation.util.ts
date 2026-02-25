import { CancellationError } from './error-context.util';
import { ErrorContext } from '../interfaces/async-handler.interface';

/**
 * CancellationToken wraps AbortController and provides cascade cancellation,
 * timeout-triggered cancellation, and child token creation.
 */
export class CancellationToken {
  private readonly controller: AbortController;
  private readonly children: Set<CancellationToken> = new Set();
  private readonly cleanupFns: Array<() => void> = [];
  private timeoutHandle?: NodeJS.Timeout;
  readonly operation: string;

  constructor(operation = 'unknown', parentSignal?: AbortSignal) {
    this.controller = new AbortController();
    this.operation = operation;

    // Cascade cancellation from parent
    if (parentSignal) {
      if (parentSignal.aborted) {
        this.cancel();
      } else {
        const onAbort = () => this.cancel();
        parentSignal.addEventListener('abort', onAbort, { once: true });
        this.cleanupFns.push(() => parentSignal.removeEventListener('abort', onAbort));
      }
    }
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get isCancelled(): boolean {
    return this.controller.signal.aborted;
  }

  /** Cancel this token and all children. */
  cancel(reason?: string): void {
    if (this.isCancelled) return;
    this.clearTimeout();
    this.controller.abort(reason ?? `Cancelled: ${this.operation}`);
    this.children.forEach((child) => child.cancel(reason));
    this.cleanupFns.forEach((fn) => fn());
  }

  /** Create a child token that is cancelled when this one is. */
  createChild(operation: string): CancellationToken {
    const child = new CancellationToken(operation, this.signal);
    this.children.add(child);
    // Auto-remove child once it completes
    child.signal.addEventListener('abort', () => this.children.delete(child), { once: true });
    return child;
  }

  /** Return a new token that auto-cancels after `ms` milliseconds. */
  withTimeout(ms: number): CancellationToken {
    const child = this.createChild(`${this.operation}:timeout(${ms}ms)`);
    child.timeoutHandle = setTimeout(() => child.cancel(`Timeout after ${ms}ms`), ms);
    return child;
  }

  /** Register a cleanup function to run on cancellation. */
  onCancelled(fn: () => void): void {
    if (this.isCancelled) {
      fn();
    } else {
      this.cleanupFns.push(fn);
      this.signal.addEventListener('abort', fn, { once: true });
    }
  }

  /** Throws CancellationError if cancelled. */
  throwIfCancelled(context: Partial<ErrorContext> = {}): void {
    if (this.isCancelled) {
      throw new CancellationError(this.operation, context);
    }
  }

  /** Returns a promise that rejects with CancellationError when cancelled. */
  toAbortPromise(): Promise<never> {
    return new Promise<never>((_, reject) => {
      if (this.isCancelled) {
        reject(new CancellationError(this.operation));
        return;
      }
      this.signal.addEventListener(
        'abort',
        () => reject(new CancellationError(this.operation)),
        { once: true },
      );
    });
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }

  dispose(): void {
    this.clearTimeout();
    this.children.forEach((child) => child.dispose());
    this.children.clear();
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns.length = 0;
  }
}

/**
 * Race a promise against a CancellationToken / AbortSignal.
 */
export async function raceWithCancellation<T>(
  promise: Promise<T>,
  token: CancellationToken | AbortSignal,
  operation = 'operation',
): Promise<T> {
  const signal = token instanceof CancellationToken ? token.signal : token;

  if (signal.aborted) {
    throw new CancellationError(operation);
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const onAbort = () => {
      if (!settled) {
        settled = true;
        reject(new CancellationError(operation));
      }
    };

    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        if (!settled) {
          settled = true;
          resolve(value);
        }
      },
      (error: Error) => {
        signal.removeEventListener('abort', onAbort);
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    );
  });
}
