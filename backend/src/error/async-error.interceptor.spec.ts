import { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AsyncErrorInterceptor } from '../interceptors/async-error.interceptor';
import { AppAsyncError } from '../utils/error-context.util';

const mockRequest = (overrides: Record<string, unknown> = {}) => ({
  method: 'GET',
  path: '/test',
  ip: '127.0.0.1',
  headers: { 'x-request-id': 'req-123', 'user-agent': 'jest' },
  route: { path: '/test' },
  user: { id: 'user-abc' },
  ...overrides,
});

const mockContext = (req: ReturnType<typeof mockRequest>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getClass: () => ({ name: 'TestController' }),
  } as unknown as ExecutionContext);

describe('AsyncErrorInterceptor', () => {
  let interceptor: AsyncErrorInterceptor;

  beforeEach(() => {
    interceptor = new AsyncErrorInterceptor(3000);
  });

  it('passes through successful responses', (done) => {
    const ctx = mockContext(mockRequest());
    const next = { handle: () => of('response-value') };

    interceptor.intercept(ctx as ExecutionContext, next as never).subscribe({
      next: (v) => expect(v).toBe('response-value'),
      complete: done,
    });
  });

  it('wraps raw errors into AppAsyncError', (done) => {
    const ctx = mockContext(mockRequest());
    const next = { handle: () => throwError(() => new Error('raw error')) };

    interceptor.intercept(ctx as ExecutionContext, next as never).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(AppAsyncError);
        expect(err.context.requestId).toBe('req-123');
        expect(err.context.userId).toBe('user-abc');
        done();
      },
    });
  });

  it('attaches correlationId from header', (done) => {
    const req = mockRequest({ headers: { 'x-correlation-id': 'corr-xyz' } });
    const ctx = mockContext(req);
    const next = { handle: () => throwError(() => new Error('err')) };

    interceptor.intercept(ctx as ExecutionContext, next as never).subscribe({
      error: (err: AppAsyncError) => {
        expect(err.context.correlationId).toBe('corr-xyz');
        done();
      },
    });
  });

  it('preserves existing AppAsyncError context', (done) => {
    const existingError = new AppAsyncError('already contextual', {
      context: { operation: 'existingOp', userId: 'user-1' },
    });

    const ctx = mockContext(mockRequest());
    const next = { handle: () => throwError(() => existingError) };

    interceptor.intercept(ctx as ExecutionContext, next as never).subscribe({
      error: (err: AppAsyncError) => {
        expect(err).toBeInstanceOf(AppAsyncError);
        done();
      },
    });
  });
});
