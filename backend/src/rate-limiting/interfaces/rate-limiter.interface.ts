export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface IRateLimiter {
  check(key: string, options?: Partial<RateLimiterOptions>): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
}

export interface RateLimitConfig {
  strategy: RateLimitStrategy;
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface AdaptiveRateLimitConfig extends RateLimitConfig {
  adaptive: boolean;
  minRequests: number;
  maxRequestsAdaptive: number;
  loadThresholds: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface RateLimitMetadata {
  requests: number;
  window: number;
  strategy?: RateLimitStrategy;
  perUser?: boolean;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (request: any) => string;
}

export interface UserTier {
  name: string;
  rateMultiplier: number;
  burstAllowance: number;
}

export enum EndpointType {
  AUTH = 'auth',
  PUBLIC = 'public',
  ADMIN = 'admin',
  API = 'api',
}

export interface EndpointRateLimitConfig {
  type: EndpointType;
  defaultLimits: RateLimitConfig;
  tierOverrides?: Record<string, Partial<RateLimitConfig>>;
}

export interface AbusePattern {
  ip: string;
  violations: number;
  firstViolation: Date;
  lastViolation: Date;
  pattern: string;
}

export interface ReputationScore {
  userId: string;
  score: number;
  goodRequests: number;
  violations: number;
  lastUpdated: Date;
}

export interface SystemLoadMetrics {
  cpuUsage: number;
  memoryUsage: number;
  requestRate: number;
  activeConnections: number;
  timestamp: Date;
}
