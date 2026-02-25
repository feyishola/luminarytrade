interface PendingRequest<T = any> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
}

export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly ttl: number;

  constructor(ttl = 5000) {
    this.ttl = ttl;
  }

  public async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if there's already a pending request for this key
    const existing = this.pendingRequests.get(key);
    
    if (existing) {
      // Return the existing promise
      return existing.promise;
    }

    // Create a new pending request
    let resolve: (value: T) => void;
    let reject: (error: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const pendingRequest: PendingRequest<T> = {
      promise,
      resolve: resolve!,
      reject: reject!,
      timestamp: Date.now()
    };

    this.pendingRequests.set(key, pendingRequest);

    try {
      const result = await requestFn();
      pendingRequest.resolve(result);
      return result;
    } catch (error) {
      pendingRequest.reject(error);
      throw error;
    } finally {
      // Clean up the pending request
      this.pendingRequests.delete(key);
    }
  }

  public generateKey(url: string, method: string, data?: any): string {
    const dataHash = data ? JSON.stringify(data) : '';
    return `${method}:${url}:${dataHash}`;
  }

  public cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      const request = this.pendingRequests.get(key);
      if (request) {
        request.reject(new Error('Request timeout due to deduplication TTL'));
        this.pendingRequests.delete(key);
      }
    });
  }

  public getPendingCount(): number {
    return this.pendingRequests.size;
  }

  public clear(): void {
    // Reject all pending requests
    for (const [key, request] of this.pendingRequests.entries()) {
      request.reject(new Error('Request cancelled due to deduplicator clear'));
    }
    this.pendingRequests.clear();
  }
}
