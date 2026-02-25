import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { AsyncExceptionFilter } from './filters/async-exception.filter';
import { AsyncErrorInterceptor } from './interceptors/async-error.interceptor';

export interface AsyncErrorHandlingModuleOptions {
  /**
   * Register global exception filter. Default: true
   */
  globalFilter?: boolean;
  /**
   * Register global error interceptor that attaches request context to errors. Default: true
   */
  globalInterceptor?: boolean;
  /**
   * Log warnings for requests exceeding this threshold (ms). Default: 3000
   */
  slowRequestThresholdMs?: number;
}

@Global()
@Module({})
export class AsyncErrorHandlingModule {
  static forRoot(options: AsyncErrorHandlingModuleOptions = {}): DynamicModule {
    const {
      globalFilter = true,
      globalInterceptor = true,
      slowRequestThresholdMs = 3000,
    } = options;

    const providers: Provider[] = [CircuitBreakerService];

    if (globalFilter) {
      providers.push({
        provide: APP_FILTER,
        useClass: AsyncExceptionFilter,
      });
    }

    if (globalInterceptor) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useFactory: () => new AsyncErrorInterceptor(slowRequestThresholdMs),
      });
    }

    return {
      module: AsyncErrorHandlingModule,
      providers,
      exports: [CircuitBreakerService],
    };
  }

  /**
   * Lightweight registration without global providers (e.g. for testing).
   */
  static forFeature(): DynamicModule {
    return {
      module: AsyncErrorHandlingModule,
      providers: [CircuitBreakerService],
      exports: [CircuitBreakerService],
    };
  }
}
