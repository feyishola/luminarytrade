import { IApiError, ErrorCode } from './types';

export class ApiError extends Error {
  public readonly status?: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly originalError?: any;

  constructor({
    message,
    status,
    code = ErrorCode.UNKNOWN_ERROR,
    details,
    requestId,
    originalError
  }: {
    message: string;
    status?: number;
    code?: ErrorCode;
    details?: Record<string, any>;
    requestId?: string;
    originalError?: any;
  }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown
    if (typeof Error.captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, ApiError);
    }
  }

  public toJSON(): IApiError {
    return {
      message: this.message,
      status: this.status,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId
    };
  }

  public static fromHttpError(
    error: any,
    requestId?: string
  ): ApiError {
    if (error.response) {
      // Server responded with error status
      const { status, statusText, data } = error.response;
      const code = this.getErrorCodeFromStatus(status);
      
      return new ApiError({
        message: data?.message || statusText || `HTTP ${status} error`,
        status,
        code,
        details: data?.details || data,
        requestId,
        originalError: error
      });
    } else if (error.request) {
      // Request was made but no response received
      return new ApiError({
        message: 'Network error: No response received',
        code: ErrorCode.NETWORK_ERROR,
        requestId,
        originalError: error
      });
    } else {
      // Something else happened in setting up the request
      return new ApiError({
        message: error.message || 'Unknown error occurred',
        code: ErrorCode.UNKNOWN_ERROR,
        requestId,
        originalError: error
      });
    }
  }

  private static getErrorCodeFromStatus(status: number): ErrorCode {
    switch (status) {
      case 400:
        return ErrorCode.VALIDATION_ERROR;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 429:
        return ErrorCode.RATE_LIMIT;
      case 500:
      case 502:
      case 503:
      case 504:
        return ErrorCode.SERVER_ERROR;
      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }

  public isNetworkError(): boolean {
    return this.code === ErrorCode.NETWORK_ERROR;
  }

  public isAuthError(): boolean {
    return this.code === ErrorCode.UNAUTHORIZED || this.code === ErrorCode.FORBIDDEN;
  }

  public isServerError(): boolean {
    return this.code === ErrorCode.SERVER_ERROR;
  }

  public isClientError(): boolean {
    return this.code === ErrorCode.VALIDATION_ERROR || 
           this.code === ErrorCode.NOT_FOUND || 
           this.code === ErrorCode.RATE_LIMIT;
  }

  public shouldRetry(): boolean {
    return this.isNetworkError() || 
           this.isServerError() || 
           this.code === ErrorCode.TIMEOUT_ERROR;
  }
}
