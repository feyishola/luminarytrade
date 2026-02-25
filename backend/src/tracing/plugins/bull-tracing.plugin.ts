import { Injectable } from '@nestjs/common';
import { TracingService } from '../tracing.service';
import * as api from '@opentelemetry/api';
import { Job } from 'bull';

/**
 * Bull queue tracing utilities
 */
@Injectable()
export class BullTracingPlugin {
  constructor(private tracingService: TracingService) {}

  /**
   * Wrap job processor with tracing
   */
  traceJobProcessor<T = any>(
    jobName: string,
    processor: (job: Job<T>) => Promise<any>,
  ): (job: Job<T>) => Promise<any> {
    return async (job: Job<T>) => {
      return this.tracingService.withSpan(
        `job.${jobName}`,
        async (span) => {
          span.setAttributes({
            'messaging.system': 'bull',
            'messaging.operation': 'process',
            'messaging.destination': job.queue.name,
            'job.id': job.id?.toString() || 'unknown',
            'job.name': jobName,
            'job.attempts': job.attemptsMade,
          });

          // Add job data attributes (be careful with sensitive data)
          if (job.data) {
            span.setAttribute('job.data_keys', Object.keys(job.data).join(','));
          }

          // Extract trace context from job data if available
          if (job.data && job.data['_traceContext']) {
            const parentContext = this.tracingService.extractContext(
              job.data['_traceContext'],
            );
            api.context.with(parentContext, () => {
              // Continue with parent context
            });
          }

          try {
            const result = await processor(job);
            span.setAttribute('job.status', 'completed');
            return result;
          } catch (error) {
            span.setAttribute('job.status', 'failed');
            throw error;
          }
        },
        {
          kind: api.SpanKind.CONSUMER,
        },
      );
    };
  }

  /**
   * Inject trace context into job data
   */
  injectTraceContext<T = any>(jobData: T): T & { _traceContext: any } {
    const traceContext: any = {};
    this.tracingService.injectContext(traceContext);

    return {
      ...jobData,
      _traceContext: traceContext,
    };
  }

  /**
   * Trace job addition to queue
   */
  async traceJobAdd(
    queueName: string,
    jobName: string,
    jobData: any,
  ): Promise<void> {
    const span = this.tracingService.startSpan(`queue.add.${jobName}`, {
      kind: api.SpanKind.PRODUCER,
    });

    span.setAttributes({
      'messaging.system': 'bull',
      'messaging.operation': 'send',
      'messaging.destination': queueName,
      'job.name': jobName,
    });

    span.end();
  }
}
