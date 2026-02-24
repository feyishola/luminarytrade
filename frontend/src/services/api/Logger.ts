import { IRequestLog, IResponseLog } from './types';

export class ApiLogger {
  private static instance: ApiLogger;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private enableConsoleLogging = true;
  private logs: Array<IRequestLog | IResponseLog> = [];
  private readonly maxLogs = 1000;

  private constructor() {}

  public static getInstance(): ApiLogger {
    if (!ApiLogger.instance) {
      ApiLogger.instance = new ApiLogger();
    }
    return ApiLogger.instance;
  }

  public setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  public setConsoleLogging(enabled: boolean): void {
    this.enableConsoleLogging = enabled;
  }

  public logRequest(request: IRequestLog): void {
    this.addLog(request);
    
    if (this.enableConsoleLogging) {
      const message = `🚀 API Request: ${request.method} ${request.url}`;
      this.consoleLog('debug', message, {
        headers: request.headers,
        body: request.body,
        requestId: request.requestId
      });
    }
  }

  public logResponse(response: IResponseLog): void {
    this.addLog(response);
    
    if (this.enableConsoleLogging) {
      const statusEmoji = this.getStatusEmoji(response.status);
      const message = `${statusEmoji} API Response: ${response.method} ${response.url} - ${response.status} (${response.duration}ms)`;
      
      const logLevel = this.getResponseLogLevel(response.status);
      this.consoleLog(logLevel, message, {
        status: response.status,
        statusText: response.statusText,
        duration: response.duration,
        requestId: response.requestId
      });
    }
  }

  public logError(error: any, requestId?: string): void {
    if (this.enableConsoleLogging) {
      const message = `❌ API Error: ${error.message || 'Unknown error'}`;
      this.consoleLog('error', message, {
        error: error,
        requestId
      });
    }
  }

  public getLogs(): Array<IRequestLog | IResponseLog> {
    return [...this.logs];
  }

  public getLogsByRequestId(requestId: string): Array<IRequestLog | IResponseLog> {
    return this.logs.filter(log => log.requestId === requestId);
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  private addLog(log: IRequestLog | IResponseLog): void {
    this.logs.push(log);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private consoleLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const shouldLog = this.shouldLogLevel(level);
    
    if (!shouldLog) {
      return;
    }

    const logMethod = this.getConsoleMethod(level);
    
    if (data) {
      logMethod(`[ApiClient] ${message}`, data);
    } else {
      logMethod(`[ApiClient] ${message}`);
    }
  }

  private shouldLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private getConsoleMethod(level: 'debug' | 'info' | 'warn' | 'error') {
    switch (level) {
      case 'debug':
        return console.debug;
      case 'info':
        return console.info;
      case 'warn':
        return console.warn;
      case 'error':
        return console.error;
      default:
        return console.log;
    }
  }

  private getResponseLogLevel(status: number): 'debug' | 'info' | 'warn' | 'error' {
    if (status >= 200 && status < 300) {
      return 'info';
    } else if (status >= 300 && status < 400) {
      return 'debug';
    } else if (status >= 400 && status < 500) {
      return 'warn';
    } else {
      return 'error';
    }
  }

  private getStatusEmoji(status: number): string {
    if (status >= 200 && status < 300) {
      return '✅';
    } else if (status >= 300 && status < 400) {
      return '↪️';
    } else if (status >= 400 && status < 500) {
      return '⚠️';
    } else {
      return '❌';
    }
  }
}
