import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { IApiResponse, IRequestConfig, HttpMethod, IRequestLog, IResponseLog } from './types';
import { ApiError } from './ApiError';
import { RequestDeduplicator } from './RequestDeduplicator';
import { RetryManager } from './RetryManager';
import { ApiLogger } from './Logger';

// Extend axios config to include metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      requestId: string;
      startTime: number;
      transformRequest?: (data: any) => any;
      transformResponse?: (data: any) => any;
    };
  }
  
  interface InternalAxiosRequestConfig {
    metadata?: {
      requestId: string;
      startTime: number;
      transformRequest?: (data: any) => any;
      transformResponse?: (data: any) => any;
    };
  }
}

export class ApiClient {
  private static instance: ApiClient;
  private axiosInstance: AxiosInstance;
  private deduplicator: RequestDeduplicator;
  private logger: ApiLogger;
  private defaultConfig: IRequestConfig;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL || '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.deduplicator = new RequestDeduplicator();
    this.logger = ApiLogger.getInstance();
    this.defaultConfig = {
      timeout: 10000,
      retries: 3,
      deduplication: true,
    };

    this.setupInterceptors();
    this.startCleanupInterval();
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => this.handleRequest(config),
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleResponseError(error)
    );
  }

  private async handleRequest(config: any): Promise<any> {
    const requestId = uuidv4();
    config.metadata = { requestId, startTime: Date.now() };

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    // Apply request transformation
    if (config.metadata?.transformRequest) {
      config.data = config.metadata.transformRequest(config.data);
    }

    // Log request
    const requestLog: IRequestLog = {
      url: config.url!,
      method: config.method?.toUpperCase() || 'GET',
      headers: config.headers as Record<string, string>,
      body: config.data,
      timestamp: new Date().toISOString(),
      requestId,
    };

    this.logger.logRequest(requestLog);

    return config;
  }

  private async handleResponse(response: AxiosResponse): Promise<AxiosResponse> {
    const { requestId, startTime } = response.config.metadata || {};
    const duration = startTime ? Date.now() - startTime : 0;

    // Apply response transformation
    let data = response.data;
    if (response.config.metadata?.transformResponse) {
      data = response.config.metadata.transformResponse(data);
    }

    // Update response data with transformed data
    response.data = data;

    // Log response
    if (requestId) {
      const responseLog: IResponseLog = {
        url: response.config.url || '',
        method: response.config.method?.toUpperCase() || 'GET',
        status: response.status,
        statusText: response.statusText,
        duration,
        timestamp: new Date().toISOString(),
        requestId,
      };

      this.logger.logResponse(responseLog);
    }

    return response;
  }

  private async handleResponseError(error: AxiosError): Promise<never> {
    const { requestId, startTime } = error.config?.metadata || {};
    const duration = startTime ? Date.now() - startTime : 0;

    // Log error response if we have a response
    if (error.response && requestId) {
      const responseLog: IResponseLog = {
        url: error.config?.url!,
        method: error.config?.method?.toUpperCase() || 'GET',
        status: error.response.status,
        statusText: error.response.statusText,
        duration,
        timestamp: new Date().toISOString(),
        requestId,
      };

      this.logger.logResponse(responseLog);
    }

    // Log error
    this.logger.logError(error, requestId);

    // Convert to ApiError and throw
    const apiError = ApiError.fromHttpError(error, requestId);
    throw apiError;
  }

  public async request<T = any>(
    method: HttpMethod,
    url: string,
    data?: any,
    config: IRequestConfig = {}
  ): Promise<IApiResponse<T>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const requestId = uuidv4();

    const axiosConfig: AxiosRequestConfig = {
      method,
      url,
      data,
      timeout: finalConfig.timeout,
      signal: finalConfig.signal,
      metadata: {
        requestId,
        startTime: Date.now(),
        transformRequest: finalConfig.transformRequest,
        transformResponse: finalConfig.transformResponse,
      },
    };

    const requestFn = async (): Promise<AxiosResponse> => {
      if (finalConfig.retries && finalConfig.retries > 0) {
        return RetryManager.executeWithRetry(
          () => this.axiosInstance.request(axiosConfig),
          { maxRetries: finalConfig.retries }
        );
      } else {
        return this.axiosInstance.request(axiosConfig);
      }
    };

    // Handle deduplication
    if (finalConfig.deduplication) {
      const key = this.deduplicator.generateKey(url, method, data);
      const response = await this.deduplicator.deduplicate(key, requestFn);
      return this.convertToApiResponse<T>(response);
    }

    const response = await requestFn();
    return this.convertToApiResponse<T>(response);
  }

  private convertToApiResponse<T>(response: AxiosResponse): IApiResponse<T> {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  public async get<T = any>(
    url: string,
    config?: IRequestConfig
  ): Promise<IApiResponse<T>> {
    return this.request<T>(HttpMethod.GET, url, undefined, config);
  }

  public async post<T = any>(
    url: string,
    data?: any,
    config?: IRequestConfig
  ): Promise<IApiResponse<T>> {
    return this.request<T>(HttpMethod.POST, url, data, config);
  }

  public async put<T = any>(
    url: string,
    data?: any,
    config?: IRequestConfig
  ): Promise<IApiResponse<T>> {
    return this.request<T>(HttpMethod.PUT, url, data, config);
  }

  public async patch<T = any>(
    url: string,
    data?: any,
    config?: IRequestConfig
  ): Promise<IApiResponse<T>> {
    return this.request<T>(HttpMethod.PATCH, url, data, config);
  }

  public async delete<T = any>(
    url: string,
    config?: IRequestConfig
  ): Promise<IApiResponse<T>> {
    return this.request<T>(HttpMethod.DELETE, url, undefined, config);
  }

  public setDefaultConfig(config: Partial<IRequestConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  public setAuthToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  public removeAuthToken(): void {
    localStorage.removeItem('authToken');
  }

  public setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logger.setLogLevel(level);
  }

  public getLogs(): Array<IRequestLog | IResponseLog> {
    return this.logger.getLogs();
  }

  public clearLogs(): void {
    this.logger.clearLogs();
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.deduplicator.cleanup();
    }, 30000); // Cleanup every 30 seconds
  }

  // Utility method to create AbortController for timeout
  public createTimeoutController(timeoutMs: number): AbortController {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller;
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();
