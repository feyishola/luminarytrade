import { CancellationToken, raceWithCancellation } from '../utils/cancellation.util';
import { CancellationError } from '../utils/error-context.util';

describe('CancellationToken', () => {
  it('is not cancelled by default', () => {
    const token = new CancellationToken('test');
    expect(token.isCancelled).toBe(false);
    token.dispose();
  });

  it('cancel() marks token as cancelled', () => {
    const token = new CancellationToken('test');
    token.cancel();
    expect(token.isCancelled).toBe(true);
    token.dispose();
  });

  it('throwIfCancelled throws CancellationError', () => {
    const token = new CancellationToken('test');
    token.cancel();
    expect(() => token.throwIfCancelled()).toThrow(CancellationError);
    token.dispose();
  });

  it('cascades cancellation to children', () => {
    const parent = new CancellationToken('parent');
    const child = parent.createChild('child');
    const grandchild = child.createChild('grandchild');

    parent.cancel();

    expect(child.isCancelled).toBe(true);
    expect(grandchild.isCancelled).toBe(true);
    parent.dispose();
  });

  it('cancels when parent signal is cancelled', () => {
    const parent = new CancellationToken('parent');
    const child = new CancellationToken('child', parent.signal);

    parent.cancel();
    expect(child.isCancelled).toBe(true);
    parent.dispose();
    child.dispose();
  });

  it('toAbortPromise() rejects on cancel', async () => {
    const token = new CancellationToken('test');
    const promise = token.toAbortPromise();
    token.cancel();
    await expect(promise).rejects.toBeInstanceOf(CancellationError);
    token.dispose();
  });

  it('withTimeout() cancels after delay', async () => {
    jest.useFakeTimers();
    const parent = new CancellationToken('parent');
    const timed = parent.withTimeout(500);

    expect(timed.isCancelled).toBe(false);
    jest.advanceTimersByTime(600);
    expect(timed.isCancelled).toBe(true);

    parent.dispose();
    jest.useRealTimers();
  });

  it('onCancelled callback fires on cancel', () => {
    const token = new CancellationToken('test');
    const cb = jest.fn();
    token.onCancelled(cb);
    token.cancel();
    expect(cb).toHaveBeenCalledTimes(1);
    token.dispose();
  });

  it('onCancelled fires immediately if already cancelled', () => {
    const token = new CancellationToken('test');
    token.cancel();
    const cb = jest.fn();
    token.onCancelled(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    token.dispose();
  });
});

describe('raceWithCancellation', () => {
  it('resolves with the promise result', async () => {
    const token = new CancellationToken('test');
    const result = await raceWithCancellation(Promise.resolve('ok'), token);
    expect(result).toBe('ok');
    token.dispose();
  });

  it('rejects when token is cancelled first', async () => {
    jest.useFakeTimers();
    const token = new CancellationToken('test');
    const slowPromise = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 1000));

    const racePromise = raceWithCancellation(slowPromise, token);
    token.cancel();

    await expect(racePromise).rejects.toBeInstanceOf(CancellationError);
    token.dispose();
    jest.useRealTimers();
  });

  it('throws immediately if token is already cancelled', async () => {
    const token = new CancellationToken('test');
    token.cancel();
    await expect(
      raceWithCancellation(Promise.resolve('ok'), token),
    ).rejects.toBeInstanceOf(CancellationError);
    token.dispose();
  });
});
