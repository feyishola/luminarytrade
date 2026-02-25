import { Test } from '@nestjs/testing';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { CircuitState } from '../constants/async-error.constants';
import { CircuitOpenError } from '../utils/error-context.util';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();
    service = module.get(CircuitBreakerService);
  });

  const KEY = 'test-circuit';

  it('executes fn when CLOSED', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(service.execute(KEY, fn)).resolves.toBe('ok');
  });

  it('opens circuit after threshold failures', async () => {
    service.register(KEY, { threshold: 3 });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      await service.execute(KEY, fn).catch(() => {});
    }

    const snap = service.snapshot(KEY)!;
    expect(snap.state).toBe(CircuitState.OPEN);
  });

  it('throws CircuitOpenError when OPEN', async () => {
    service.register(KEY, { threshold: 1 });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await service.execute(KEY, fn).catch(() => {});
    await expect(service.execute(KEY, jest.fn())).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('transitions to HALF_OPEN after resetTimeoutMs', async () => {
    jest.useFakeTimers();
    service.register(KEY, { threshold: 1, resetTimeoutMs: 1000 });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await service.execute(KEY, fn).catch(() => {});
    expect(service.snapshot(KEY)!.state).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(1100);

    // Trigger the transition check
    const successFn = jest.fn().mockResolvedValue('ok');
    await service.execute(KEY, successFn);
    expect(service.snapshot(KEY)!.state).not.toBe(CircuitState.OPEN);

    jest.useRealTimers();
  });

  it('calls onStateChange callback on transitions', async () => {
    const onStateChange = jest.fn();
    service.register(KEY, { threshold: 1, onStateChange });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await service.execute(KEY, fn).catch(() => {});

    expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN);
  });

  it('reset() returns circuit to CLOSED', async () => {
    service.register(KEY, { threshold: 1 });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    await service.execute(KEY, fn).catch(() => {});

    service.reset(KEY);
    expect(service.snapshot(KEY)!.state).toBe(CircuitState.CLOSED);
  });

  it('allSnapshots returns all registered circuits', () => {
    service.register('a', {});
    service.register('b', {});
    const snaps = service.allSnapshots();
    expect(Object.keys(snaps)).toContain('a');
    expect(Object.keys(snaps)).toContain('b');
  });

  it('does not count non-failures when isFailure returns false', async () => {
    const isFailure = jest.fn().mockReturnValue(false);
    service.register(KEY, { threshold: 1, isFailure });
    const fn = jest.fn().mockRejectedValue(new Error('ignored'));

    await service.execute(KEY, fn).catch(() => {});

    expect(service.snapshot(KEY)!.state).toBe(CircuitState.CLOSED);
  });
});
