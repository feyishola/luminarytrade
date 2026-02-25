import { ApiClient } from '../ApiClient';
import { ApiError } from '../ApiError';
import { ApiLogger } from '../Logger';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock uuid
jest.mock('uuid');
const mockedUuid = require('uuid');

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create
    mockAxiosInstance = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockedUuid.v4.mockReturnValue('test-request-id');
    
    // Get singleton instance
    apiClient = ApiClient.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ApiClient.getInstance();
      const instance2 = ApiClient.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Request Interceptor', () => {
    it('should add auth token when available', () => {
      localStorageMock.getItem.mockReturnValue('test-token');
      
      const requestConfig = {
        url: '/test',
        method: 'GET',
        headers: {},
      };
      
      // Get the request interceptor function
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      const result = requestInterceptor(requestConfig);
      
      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    it('should add metadata to request', () => {
      const requestConfig = {
        url: '/test',
        method: 'GET',
        headers: {},
      };
      
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      const result = requestInterceptor(requestConfig);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.requestId).toBe('test-request-id');
      expect(result.metadata.startTime).toBeDefined();
    });

    it('should apply request transformation', () => {
      const transformFn = jest.fn((data) => ({ transformed: data }));
      const requestConfig = {
        url: '/test',
        method: 'POST',
        data: { test: 'data' },
        headers: {},
        metadata: {
          requestId: 'test-id',
          startTime: Date.now(),
          transformRequest: transformFn,
        },
      };
      
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      const result = requestInterceptor(requestConfig);
      
      expect(transformFn).toHaveBeenCalledWith({ test: 'data' });
      expect(result.data).toEqual({ transformed: { test: 'data' } });
    });
  });

  describe('Response Interceptor', () => {
    it('should apply response transformation', () => {
      const transformFn = jest.fn((data) => ({ transformed: data }));
      const response = {
        data: { test: 'response' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/test',
          method: 'GET',
          metadata: {
            requestId: 'test-id',
            startTime: Date.now() - 100,
            transformResponse: transformFn,
          },
        },
      };
      
      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      const result = responseInterceptor(response);
      
      expect(transformFn).toHaveBeenCalledWith({ test: 'response' });
      expect(result.data).toEqual({ transformed: { test: 'response' } });
    });

    it('should log response with duration', () => {
      const loggerSpy = jest.spyOn(ApiLogger.getInstance(), 'logResponse');
      const startTime = Date.now() - 100;
      
      const response = {
        data: { test: 'response' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/test',
          method: 'GET',
          metadata: {
            requestId: 'test-id',
            startTime,
          },
        },
      };
      
      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      responseInterceptor(response);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-id',
          duration: expect.any(Number),
          status: 200,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should convert axios errors to ApiError', () => {
      const axiosError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: 'Resource not found' },
        },
        config: {
          url: '/test',
          metadata: { requestId: 'test-id' },
        },
      };
      
      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      
      expect(() => errorInterceptor(axiosError)).toThrow(ApiError);
    });

    it('should handle network errors', () => {
      const networkError = {
        request: {},
        message: 'Network Error',
        config: {
          url: '/test',
          metadata: { requestId: 'test-id' },
        },
      };
      
      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      
      expect(() => errorInterceptor(networkError)).toThrow(ApiError);
    });
  });

  describe('HTTP Methods', () => {
    beforeEach(() => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
      });
    });

    it('should make GET request', async () => {
      const result = await apiClient.get('/test');
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/test',
        })
      );
      expect(result.data).toEqual({ test: 'data' });
    });

    it('should make POST request', async () => {
      const postData = { name: 'test' };
      const result = await apiClient.post('/test', postData);
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/test',
          data: postData,
        })
      );
      expect(result.data).toEqual({ test: 'data' });
    });

    it('should make PUT request', async () => {
      const putData = { name: 'updated' };
      const result = await apiClient.put('/test', putData);
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/test',
          data: putData,
        })
      );
    });

    it('should make DELETE request', async () => {
      await apiClient.delete('/test');
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: '/test',
        })
      );
    });
  });

  describe('Authentication', () => {
    it('should set auth token', () => {
      apiClient.setAuthToken('test-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', 'test-token');
    });

    it('should remove auth token', () => {
      apiClient.removeAuthToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });

    it('should get auth token from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('stored-token');
      
      // Trigger request interceptor to test token retrieval
      const requestConfig = { url: '/test', method: 'GET', headers: {} };
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      requestInterceptor(requestConfig);
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('authToken');
      expect(requestConfig.headers.Authorization).toBe('Bearer stored-token');
    });
  });

  describe('Configuration', () => {
    it('should set default configuration', () => {
      apiClient.setDefaultConfig({
        timeout: 5000,
        retries: 2,
        deduplication: false,
      });
      
      // Test that config is applied to requests
      apiClient.get('/test');
      
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
          metadata: expect.objectContaining({
            transformRequest: undefined,
            transformResponse: undefined,
          }),
        })
      );
    });
  });

  describe('Logging', () => {
    it('should set log level', () => {
      const loggerSpy = jest.spyOn(ApiLogger.getInstance(), 'setLogLevel');
      apiClient.setLogLevel('debug');
      expect(loggerSpy).toHaveBeenCalledWith('debug');
    });

    it('should get logs', () => {
      const loggerSpy = jest.spyOn(ApiLogger.getInstance(), 'getLogs');
      apiClient.getLogs();
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should clear logs', () => {
      const loggerSpy = jest.spyOn(ApiLogger.getInstance(), 'clearLogs');
      apiClient.clearLogs();
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('Request Cancellation', () => {
    it('should create timeout controller', () => {
      const controller = apiClient.createTimeoutController(1000);
      expect(controller).toBeInstanceOf(AbortController);
      
      // Test that it aborts after timeout
      jest.advanceTimersByTime(1000);
      expect(controller.signal.aborted).toBe(true);
    });
  });
});
