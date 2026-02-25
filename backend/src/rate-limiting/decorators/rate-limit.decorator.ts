import { SetMetadata } from '@nestjs/common';
import { RateLimitMetadata, RateLimitStrategy } from '../interfaces/rate-limiter.interface';

export const RATE_LIMIT_KEY = 'rate_limit';

export const RateLimit = (
  requests: number,
  window: number,
  strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW,
  options: Partial<Omit<RateLimitMetadata, 'requests' | 'window' | 'strategy'>> = {},
) => {
  return SetMetadata(RATE_LIMIT_KEY, {
    requests,
    window,
    strategy,
    ...options,
  } as RateLimitMetadata);
};

export const ThrottlePerUser = (
  requests: number,
  window: number,
  strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW,
) => {
  return SetMetadata(RATE_LIMIT_KEY, {
    requests,
    window,
    strategy,
    perUser: true,
  } as RateLimitMetadata);
};

export const RateLimitByEndpoint = (
  endpointType: 'auth' | 'public' | 'admin' | 'api',
) => {
  return SetMetadata('rate_limit_endpoint_type', endpointType);
};

export const SkipRateLimit = () => {
  return SetMetadata('skip_rate_limit', true);
};

export const RateLimitTier = (tier: string) => {
  return SetMetadata('rate_limit_tier', tier);
};
