import { ApiError } from '../ApiError';
import { ErrorCode } from '../types';

describe('ApiError', () => {
  describe('Constructor', () => {
    it('should create ApiError with basic properties', () => {
      const error = new ApiError({
        message: 'Test error',
        status: 400,
        code: ErrorCode.VALIDATION_ERROR,
      });

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.name).toBe('ApiError');
      expect(error.timestamp).toBeDefined();
    });

    it('should create ApiError with details and requestId', () => {
      const details = { field: 'email', issue: 'invalid format' };
      const error = new ApiError({
        message: 'Validation error',
        status: 422,
        code: ErrorCode.VALIDATION_ERROR,
        details,
        requestId: 'test-request-id',
      });

      expect(error.details).toEqual(details);
      expect(error.requestId).toBe('test-request-id');
    });
  });

  describe('fromHttpError', () => {
    it('should create ApiError from axios response error', () => {
      const axiosError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: 'Resource not found' },
        },
        config: { url: '/test' },
      };

      const apiError = ApiError.fromHttpError(axiosError);

      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError.status).toBe(404);
      expect(apiError.code).toBe(ErrorCode.NOT_FOUND);
      expect(apiError.message).toBe('Resource not found');
    });

    it('should create ApiError from network error', () => {
      const networkError = {
        request: {},
        message: 'Network Error',
        config: { url: '/test' },
      };

      const apiError = ApiError.fromHttpError(networkError);

      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(apiError.message).toBe('Network error: No response received');
    });

    it('should create ApiError from unknown error', () => {
      const unknownError = {
        message: 'Unknown error occurred',
        config: { url: '/test' },
      };

      const apiError = ApiError.fromHttpError(unknownError);

      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(apiError.message).toBe('Unknown error occurred');
    });
  });

  describe('Error Type Detection', () => {
    it('should identify network errors', () => {
      const error = new ApiError({
        message: 'Network error',
        code: ErrorCode.NETWORK_ERROR,
      });

      expect(error.isNetworkError()).toBe(true);
      expect(error.isAuthError()).toBe(false);
      expect(error.isServerError()).toBe(false);
      expect(error.isClientError()).toBe(false);
    });

    it('should identify auth errors', () => {
      const unauthorizedError = new ApiError({
        message: 'Unauthorized',
        code: ErrorCode.UNAUTHORIZED,
      });

      expect(unauthorizedError.isAuthError()).toBe(true);
      expect(unauthorizedError.isNetworkError()).toBe(false);

      const forbiddenError = new ApiError({
        message: 'Forbidden',
        code: ErrorCode.FORBIDDEN,
      });

      expect(forbiddenError.isAuthError()).toBe(true);
    });

    it('should identify server errors', () => {
      const error = new ApiError({
        message: 'Server error',
        code: ErrorCode.SERVER_ERROR,
      });

      expect(error.isServerError()).toBe(true);
      expect(error.isNetworkError()).toBe(false);
      expect(error.isClientError()).toBe(false);
    });

    it('should identify client errors', () => {
      const validationError = new ApiError({
        message: 'Validation error',
        code: ErrorCode.VALIDATION_ERROR,
      });

      expect(validationError.isClientError()).toBe(true);

      const notFoundError = new ApiError({
        message: 'Not found',
        code: ErrorCode.NOT_FOUND,
      });

      expect(notFoundError.isClientError()).toBe(true);

      const rateLimitError = new ApiError({
        message: 'Rate limit exceeded',
        code: ErrorCode.RATE_LIMIT,
      });

      expect(rateLimitError.isClientError()).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should determine which errors should be retried', () => {
      const networkError = new ApiError({
        message: 'Network error',
        code: ErrorCode.NETWORK_ERROR,
      });

      const serverError = new ApiError({
        message: 'Server error',
        code: ErrorCode.SERVER_ERROR,
      });

      const timeoutError = new ApiError({
        message: 'Timeout',
        code: ErrorCode.TIMEOUT_ERROR,
      });

      const validationError = new ApiError({
        message: 'Validation error',
        code: ErrorCode.VALIDATION_ERROR,
      });

      expect(networkError.shouldRetry()).toBe(true);
      expect(serverError.shouldRetry()).toBe(true);
      expect(timeoutError.shouldRetry()).toBe(true);
      expect(validationError.shouldRetry()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new ApiError({
        message: 'Test error',
        status: 400,
        code: ErrorCode.VALIDATION_ERROR,
        details: { field: 'email' },
        requestId: 'test-id',
      });

      const json = error.toJSON();

      expect(json).toEqual({
        message: 'Test error',
        status: 400,
        code: ErrorCode.VALIDATION_ERROR,
        details: { field: 'email' },
        timestamp: error.timestamp,
        requestId: 'test-id',
      });
    });
  });
});
