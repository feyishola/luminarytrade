import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitState,
  DEFAULT_CIRCUIT_BREAKER_HALF_OPEN_MAX,
  DEFAULT_CIRCUIT_BREAKER_RESET_MS,
  DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
} from '../constants/async-error.constants';
import { CircuitBreakerOptions, CircuitBreakerSnapshot } from '../interfaces/async-handler.interface';
import { CircuitOpenError } from '../utils/error-context.util';

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  successes: number;
  halfOpenAttempts: number;
  lastFailureAt?: Date;
  openedAt?: Date;
  options: Required<Omit<CircuitBreakerOptions, 'isFailure' | 'onStateChange'>>;
  isFailure: (error: Error) => boolean;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitRecord>();

  /**
   * Register a circuit breaker for a named operation.
   * Idempotent — safe to call multiple times with the same key.
   */
  register(key: string, options: CircuitBreakerOptions = {}): void {
    if (this.circuits.has(key)) return;

    this.circuits.set(key, {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      halfOpenAttempts: 0,
      options: {
        threshold: options.threshold ?? DEFAULT_CIRCUIT_BREAKER_THRESHOLD,
        resetTimeoutMs: options.resetTimeoutMs ?? DEFAULT_CIRCUIT_BREAKER_RESET_MS,
        halfOpenMax: options.halfOpenMax ?? DEFAULT_CIRCUIT_BREAKER_HALF_OPEN_MAX,
      },
      isFailure: options.isFailure ?? (() => true),
      onStateChange: options.onStateChange,
    });
  }

  /**
   * Execute `fn` guarded by the named circuit breaker.
   *
   * @throws CircuitOpenError when the circuit is OPEN
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.getOrRegister(key);

    this.transitionIfNeeded(key, circuit);

    if (circuit.state === CircuitState.OPEN) {
      const nextAttemptAt = new Date(
        (circuit.openedAt?.getTime() ?? 0) + circuit.options.resetTimeoutMs,
      );
      throw new CircuitOpenError(key, nextAttemptAt);
    }

    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.halfOpenAttempts >= circuit.options.halfOpenMax) {
        this.transition(key, circuit, CircuitState.OPEN);
        const nextAttemptAt = new Date(Date.now() + circuit.options.resetTimeoutMs);
        throw new CircuitOpenError(key, nextAttemptAt);
      }
      circuit.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.onSuccess(key, circuit);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (circuit.isFailure(error)) {
        this.onFailure(key, circuit);
      } else {
        this.onSuccess(key, circuit);
      }
      throw err;
    }
  }

  snapshot(key: string): CircuitBreakerSnapshot | null {
    const circuit = this.circuits.get(key);
    if (!circuit) return null;

    const nextAttemptAt =
      circuit.state === CircuitState.OPEN && circuit.openedAt
        ? new Date(circuit.openedAt.getTime() + circuit.options.resetTimeoutMs)
        : undefined;

    return {
      state: circuit.state,
      failures: circuit.failures,
      successes: circuit.successes,
      lastFailureAt: circuit.lastFailureAt,
      nextAttemptAt,
    };
  }

  reset(key: string): void {
    const circuit = this.circuits.get(key);
    if (!circuit) return;
    circuit.state = CircuitState.CLOSED;
    circuit.failures = 0;
    circuit.successes = 0;
    circuit.halfOpenAttempts = 0;
    circuit.lastFailureAt = undefined;
    circuit.openedAt = undefined;
    this.logger.log(`Circuit "${key}" manually reset`);
  }

  allSnapshots(): Record<string, CircuitBreakerSnapshot> {
    const result: Record<string, CircuitBreakerSnapshot> = {};
    for (const [key] of this.circuits) {
      const snap = this.snapshot(key);
      if (snap) result[key] = snap;
    }
    return result;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private getOrRegister(key: string): CircuitRecord {
    if (!this.circuits.has(key)) this.register(key);
    return this.circuits.get(key)!;
  }

  private transitionIfNeeded(key: string, circuit: CircuitRecord): void {
    if (circuit.state === CircuitState.OPEN && circuit.openedAt) {
      const elapsed = Date.now() - circuit.openedAt.getTime();
      if (elapsed >= circuit.options.resetTimeoutMs) {
        circuit.halfOpenAttempts = 0;
        this.transition(key, circuit, CircuitState.HALF_OPEN);
      }
    }
  }

  private onSuccess(key: string, circuit: CircuitRecord): void {
    circuit.successes++;
    if (circuit.state === CircuitState.HALF_OPEN) {
      // All probes succeeded → close
      if (circuit.halfOpenAttempts >= circuit.options.halfOpenMax) {
        circuit.failures = 0;
        circuit.halfOpenAttempts = 0;
        this.transition(key, circuit, CircuitState.CLOSED);
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      // Sliding window: reset failure count on success
      circuit.failures = Math.max(0, circuit.failures - 1);
    }
  }

  private onFailure(key: string, circuit: CircuitRecord): void {
    circuit.failures++;
    circuit.lastFailureAt = new Date();

    if (
      circuit.state === CircuitState.CLOSED &&
      circuit.failures >= circuit.options.threshold
    ) {
      circuit.openedAt = new Date();
      this.transition(key, circuit, CircuitState.OPEN);
    } else if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.openedAt = new Date();
      this.transition(key, circuit, CircuitState.OPEN);
    }
  }

  private transition(key: string, circuit: CircuitRecord, to: CircuitState): void {
    const from = circuit.state;
    circuit.state = to;
    this.logger.warn(`Circuit "${key}": ${from} → ${to}`);
    circuit.onStateChange?.(from, to);
  }
}
