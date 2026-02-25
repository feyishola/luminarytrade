import { Injectable } from '@nestjs/common';
import { TracingService } from '../tracing.service';
import * as api from '@opentelemetry/api';

/**
 * TypeORM subscriber to trace database queries
 */
@Injectable()
export class TypeOrmTracingSubscriber {
  constructor(private tracingService: TracingService) {}

  /**
   * Called before query execution
   */
  beforeQuery(event: any) {
    const span = this.tracingService.startSpan('database.query', {
      kind: api.SpanKind.CLIENT,
    });

    span.setAttributes({
      'db.system': 'postgresql',
      'db.statement': event.query,
      'db.operation': this.extractOperation(event.query),
    });

    if (event.parameters && event.parameters.length > 0) {
      span.setAttribute('db.parameters', JSON.stringify(event.parameters));
    }

    // Store span in event for later retrieval
    event['_span'] = span;
  }

  /**
   * Called after query execution
   */
  afterQuery(event: any) {
    const span = event['_span'];
    if (span) {
      span.setAttribute('db.execution_time_ms', event.executionTime || 0);
      span.setStatus({ code: api.SpanStatusCode.OK });
      span.end();
    }
  }

  /**
   * Called on query error
   */
  onQueryError(error: any, event: any) {
    const span = event['_span'];
    if (span) {
      this.tracingService.recordException(span, error);
      span.end();
    }
  }

  private extractOperation(query: string): string {
    const normalized = query.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    if (normalized.startsWith('CREATE')) return 'CREATE';
    if (normalized.startsWith('ALTER')) return 'ALTER';
    if (normalized.startsWith('DROP')) return 'DROP';
    return 'UNKNOWN';
  }
}
