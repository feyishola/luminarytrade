import { collectStream, batchStream, mapStream, paginatedGenerator } from '../utils/async-iterator.util';
import { CancellationToken } from '../utils/cancellation.util';
import { GeneratorError } from '../utils/error-context.util';

async function* numbersGenerator(count: number, failAt?: number): AsyncGenerator<number> {
  for (let i = 0; i < count; i++) {
    if (i === failAt) throw new Error(`Failed at index ${i}`);
    yield i;
  }
}

describe('collectStream', () => {
  it('collects all items', async () => {
    const result = await collectStream(numbersGenerator(5));
    expect(result.items).toEqual([0, 1, 2, 3, 4]);
    expect(result.totalItems).toBe(5);
    expect(result.errors).toHaveLength(0);
  });

  it('calls onItem for each element', async () => {
    const onItem = jest.fn();
    await collectStream(numbersGenerator(3), { onItem });
    expect(onItem).toHaveBeenCalledTimes(3);
    expect(onItem).toHaveBeenNthCalledWith(1, 0, 0);
  });

  it('calls onComplete with total items', async () => {
    const onComplete = jest.fn();
    await collectStream(numbersGenerator(4), { onComplete });
    expect(onComplete).toHaveBeenCalledWith(4);
  });

  it('aborts stream on generator error when onError not set', async () => {
    await expect(collectStream(numbersGenerator(10, 3))).rejects.toBeInstanceOf(GeneratorError);
  });

  it('continues stream when onError returns true', async () => {
    const onError = jest.fn().mockResolvedValue(true);
    const result = await collectStream(numbersGenerator(5, 2), { onError });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('stops when cancelled', async () => {
    const token = new CancellationToken('test');
    let itemCount = 0;

    async function* infiniteGen(): AsyncGenerator<number> {
      let n = 0;
      while (true) yield n++;
    }

    const promise = collectStream(infiniteGen(), {
      onItem: async () => {
        itemCount++;
        if (itemCount === 3) token.cancel();
      },
      signal: token.signal,
    });

    const result = await promise;
    expect(result.cancelled).toBe(true);
    token.dispose();
  });
});

describe('batchStream', () => {
  it('batches items correctly', async () => {
    const batches: number[][] = [];
    for await (const batch of batchStream(numbersGenerator(10), 3)) {
      batches.push(batch);
    }
    expect(batches[0]).toEqual([0, 1, 2]);
    expect(batches[1]).toEqual([3, 4, 5]);
    expect(batches[3]).toEqual([9]); // remainder
  });

  it('stops on cancellation', async () => {
    const token = new CancellationToken('batch-test');
    const batches: number[][] = [];

    async function* forever(): AsyncGenerator<number> {
      let n = 0;
      while (true) yield n++;
    }

    setTimeout(() => token.cancel(), 0);

    try {
      for await (const batch of batchStream(forever(), 5, token.signal)) {
        batches.push(batch);
      }
    } catch {
      // expected
    }

    token.dispose();
    expect(batches.length).toBeLessThan(1000);
  });
});

describe('mapStream', () => {
  it('transforms each item', async () => {
    const results: string[] = [];
    for await (const item of mapStream(numbersGenerator(3), async (n) => `item-${n}`)) {
      results.push(item);
    }
    expect(results).toEqual(['item-0', 'item-1', 'item-2']);
  });
});

describe('paginatedGenerator', () => {
  it('fetches all pages', async () => {
    const pages = [
      { items: [1, 2], next: 'page2' },
      { items: [3, 4], next: 'page3' },
      { items: [5], next: null },
    ];
    let pageIndex = 0;

    const items: number[] = [];
    for await (const item of paginatedGenerator(
      () => Promise.resolve(pages[pageIndex++]),
      (page) => page.next,
      (page) => page.items,
    )) {
      items.push(item);
    }

    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});
