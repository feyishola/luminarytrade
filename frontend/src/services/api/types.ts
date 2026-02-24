export interface IApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  success: boolean;
  timestamp: string;
}

export interface IApiError {
  message: string;
  status?: number;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

export interface IRequestConfig {
  timeout?: number;
  retries?: number;
  deduplication?: boolean;
  signal?: AbortSignal;
  transformRequest?: (data: any) => any;
  transformResponse?: (data: any) => any;
}

export interface IRetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: any) => boolean;
  backoffMultiplier?: number;
  maxDelay?: number;
}

export interface IRequestLog {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: string;
  requestId: string;
}

export interface IResponseLog {
  url: string;
  method: string;
  status: number;
  statusText: string;
  duration: number;
  timestamp: string;
  requestId: string;
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS'
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
