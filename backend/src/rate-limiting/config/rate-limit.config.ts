import {
  RateLimitConfig,
  RateLimitStrategy,
  EndpointType,
  EndpointRateLimitConfig,
  UserTier,
  AdaptiveRateLimitConfig,
} from '../interfaces/rate-limiter.interface';

export { EndpointType };

export const defaultRateLimitConfigs: Record<EndpointType, EndpointRateLimitConfig> = {
  [EndpointType.AUTH]: {
    type: EndpointType.AUTH,
    defaultLimits: {
      strategy: RateLimitStrategy.FIXED_WINDOW,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // Very strict for auth endpoints
      keyPrefix: 'ratelimit:auth',
    },
    tierOverrides: {
      premium: {
        maxRequests: 10,
      },
    },
  },
  [EndpointType.PUBLIC]: {
    type: EndpointType.PUBLIC,
    defaultLimits: {
      strategy: RateLimitStrategy.SLIDING_WINDOW,
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // Moderate for public endpoints
      keyPrefix: 'ratelimit:public',
    },
    tierOverrides: {
      basic: {
        maxRequests: 120,
      },
      premium: {
        maxRequests: 300,
      },
    },
  },
  [EndpointType.ADMIN]: {
    type: EndpointType.ADMIN,
    defaultLimits: {
      strategy: RateLimitStrategy.TOKEN_BUCKET,
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 300, // Relaxed for admin
      keyPrefix: 'ratelimit:admin',
    },
    tierOverrides: {
      admin: {
        maxRequests: 1000,
      },
    },
  },
  [EndpointType.API]: {
    type: EndpointType.API,
    defaultLimits: {
      strategy: RateLimitStrategy.TOKEN_BUCKET,
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyPrefix: 'ratelimit:api',
    },
    tierOverrides: {
      free: {
        maxRequests: 60,
      },
      basic: {
        maxRequests: 300,
      },
      premium: {
        maxRequests: 1000,
      },
    },
  },
};

export const userTiers: Record<string, UserTier> = {
  free: {
    name: 'free',
    rateMultiplier: 1.0,
    burstAllowance: 10,
  },
  basic: {
    name: 'basic',
    rateMultiplier: 2.0,
    burstAllowance: 20,
  },
  premium: {
    name: 'premium',
    rateMultiplier: 5.0,
    burstAllowance: 50,
  },
  admin: {
    name: 'admin',
    rateMultiplier: 10.0,
    burstAllowance: 100,
  },
};

export const adaptiveConfig: AdaptiveRateLimitConfig = {
  strategy: RateLimitStrategy.TOKEN_BUCKET,
  windowMs: 60 * 1000,
  maxRequests: 100,
  adaptive: true,
  minRequests: 20,
  maxRequestsAdaptive: 200,
  keyPrefix: 'ratelimit:adaptive',
  loadThresholds: {
    low: 30,    // 0-30% load
    medium: 60, // 30-60% load
    high: 85,   // 60-85% load
  },
};

export const whitelistConfig = {
  ips: process.env.RATE_LIMIT_WHITELIST?.split(',') || [],
  cidrs: process.env.RATE_LIMIT_WHITELIST_CIDR?.split(',') || [],
};

export const blacklistConfig = {
  ips: process.env.RATE_LIMIT_BLACKLIST?.split(',') || [],
  cidrs: process.env.RATE_LIMIT_BLACKLIST_CIDR?.split(',') || [],
  autoBlacklistThreshold: parseInt(process.env.RATE_LIMIT_AUTO_BLACKLIST_THRESHOLD || '10', 10),
  autoBlacklistWindowMs: parseInt(process.env.RATE_LIMIT_AUTO_BLACKLIST_WINDOW || '3600000', 10), // 1 hour
};

export function getRateLimitConfig(
  endpointType: EndpointType,
  userTier?: string,
): RateLimitConfig {
  const config = defaultRateLimitConfigs[endpointType];
  const baseConfig = { ...config.defaultLimits };

  if (userTier && config.tierOverrides?.[userTier]) {
    const override = config.tierOverrides[userTier];
    return {
      ...baseConfig,
      ...override,
    };
  }

  return baseConfig;
}

export function applyTierMultiplier(
  config: RateLimitConfig,
  tier: string,
): RateLimitConfig {
  const tierConfig = userTiers[tier];
  if (!tierConfig) return config;

  return {
    ...config,
    maxRequests: Math.floor(config.maxRequests * tierConfig.rateMultiplier),
  };
}
