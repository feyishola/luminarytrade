import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { TracingInterceptor } from './tracing.interceptor';
import { TracingService } from '../tracing.service';
import * as api from '@opentelemetry/api';

describe('TracingInterceptor', () => {
  let interceptor: TracingInterceptor;
  let tracingService: TracingService;
  let mockSpan: jest.Mocked<api.Span>;

  beforeEach(async () => {
    mockSpan = {
      setAttributes: jest.fn(),
      setAttribute: jest.fn(),
      setStatus: jest.fn(),
      end: jest.fn(),
      spanContext: jest.fn().mockReturnValue({
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
      }),
      recordException: jest.fn(),
      addEvent: jest.fn(),
      updateName: jest.fn(),
      isRecording: jest.fn().mockReturnValue(true),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracingInterceptor,
        {
          provide: TracingService,
          useValue: {
            startSpan: jest.fn().mockReturnValue(mockSpan),
            recordException: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<TracingInterceptor>(TracingInterceptor);
    tracingService = module.get<TracingService>(TracingService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    let mockExecutionContext: ExecutionContext;
    let mockCallHandler: CallHandler;

    beforeEach(() => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { id: '123' },
            query: { filter: 'active' },
          }),
        }),
        getHandler: jest.fn().mockReturnValue({
          name: 'testHandler',
        }),
        getClass: jest.fn().mockReturnValue({
          name: 'TestController',
        }),
      } as any;

      mockCallHandler = {
        handle: jest.fn(),
      } as any;
    });

    it('should create span with controller and handler name', (done) => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(tracingService.startSpan).toHaveBeenCalledWith(
            'TestController.testHandler',
            expect.any(Object),
          );
          done();
        },
      });
    });

    it('should add request parameters to span', (done) => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockSpan.setAttribute).toHaveBeenCalledWith(
            'request.params',
            JSON.stringify({ id: '123' }),
          );
          expect(mockSpan.setAttribute).toHaveBeenCalledWith(
            'request.query',
            JSON.stringify({ filter: 'active' }),
          );
          done();
        },
      });
    });

    it('should record success and end span', (done) => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: api.SpanStatusCode.OK,
          });
          expect(mockSpan.end).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should record error and end span', (done) => {
      const error = new Error('Test error');
      (mockCallHandler.handle as jest.Mock).mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(tracingService.recordException).toHaveBeenCalledWith(mockSpan, error);
          expect(mockSpan.end).toHaveBeenCalled();
          expect(err).toBe(error);
          done();
        },
      });
    });

    it('should track handler duration', (done) => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ data: 'test' }));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockSpan.setAttribute).toHaveBeenCalledWith(
            'handler.duration_ms',
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should track array response length', (done) => {
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of([1, 2, 3]));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockSpan.setAttribute).toHaveBeenCalledWith('response.array_length', 3);
          done();
        },
      });
    });
  });
});
