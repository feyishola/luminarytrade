// Base interface for all controllers
export interface IBaseController {
  // Health check method that all controllers should implement
  healthCheck?(): Promise<{ status: string; timestamp: Date }>;
}

// Observable interface for real-time operations
export interface IObservableController<T = any> {
  subscribe(observer: (data: T) => void): () => void; // Returns unsubscribe function
  notify(data: T): void;
}

// Real-time operations interface
export interface IRealTimeOperations<T = any> {
  streamUpdates(): AsyncGenerator<T, void, unknown>;
  subscribeToEvents(callback: (event: T) => void): Promise<string>; // Returns subscription ID
  unsubscribeFromEvents(subscriptionId: string): Promise<void>;
}