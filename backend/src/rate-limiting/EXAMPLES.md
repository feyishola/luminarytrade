# Rate Limiting Usage Examples

## Basic Usage

### Using the @RateLimit Decorator

```typescript
import { Controller, Get } from '@nestjs/common';
import { RateLimit, RateLimitStrategy } from './rate-limiting';

@Controller('api')
export class ApiController {
  
  @Get('data')
  @RateLimit(100, 60000, RateLimitStrategy.SLIDING_WINDOW)
  getData() {
    return { data: 'some data' };
  }
  
  @Get('burst')
  @RateLimit(50, 60000, RateLimitStrategy.TOKEN_BUCKET)
  getBurstData() {
    return { data: 'burst data' };
  }
}
```

### Per-User Rate Limiting

```typescript
import { Controller, Get } from '@nestjs/common';
import { ThrottlePerUser } from './rate-limiting';

@Controller('user')
export class UserController {
  
  @Get('profile')
  @ThrottlePerUser(30, 60000) // 30 requests per minute per user
  getProfile() {
    return { profile: 'user profile' };
  }
}
```

### Endpoint Type Configuration

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { RateLimitByEndpoint } from './rate-limiting';

@Controller('auth')
export class AuthController {
  
  @Post('login')
  @RateLimitByEndpoint('auth') // Uses strict auth limits (5 requests per 15 min)
  login() {
    return { token: 'jwt-token' };
  }
}

@Controller('public')
export class PublicController {
  
  @Get('info')
  @RateLimitByEndpoint('public') // Uses moderate public limits (60 requests per min)
  getInfo() {
    return { info: 'public info' };
  }
}

@Controller('admin')
export class AdminController {
  
  @Get('dashboard')
  @RateLimitByEndpoint('admin') // Uses relaxed admin limits (300 requests per min)
  getDashboard() {
    return { dashboard: 'admin dashboard' };
  }
}
```

### Skipping Rate Limiting

```typescript
import { Controller, Get } from '@nestjs/common';
import { SkipRateLimit } from './rate-limiting';

@Controller('health')
export class HealthController {
  
  @Get()
  @SkipRateLimit()
  healthCheck() {
    return { status: 'ok' };
  }
}
```

### Tier-Based Rate Limiting

```typescript
import { Controller, Get } from '@nestjs/common';
import { RateLimitTier, RateLimitByEndpoint } from './rate-limiting';

@Controller('premium')
export class PremiumController {
  
  @Get('features')
  @RateLimitByEndpoint('api')
  @RateLimitTier('premium') // Uses premium tier multipliers (5x base limits)
  getPremiumFeatures() {
    return { features: 'premium features' };
  }
}
```

## Admin API Usage

### Managing Whitelist

```bash
# Get whitelist
curl http://localhost:3000/admin/rate-limiting/whitelist

# Add IP to whitelist
curl -X POST http://localhost:3000/admin/rate-limiting/whitelist \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.100"}'

# Remove IP from whitelist
curl -X DELETE http://localhost:3000/admin/rate-limiting/whitelist/192.168.1.100
```

### Managing Blacklist

```bash
# Get blacklist
curl http://localhost:3000/admin/rate-limiting/blacklist

# Add IP to blacklist
curl -X POST http://localhost:3000/admin/rate-limiting/blacklist \
  -H "Content-Type: application/json" \
  -d '{"ip": "10.0.0.50", "reason": "Suspicious activity"}'

# Remove IP from blacklist
curl -X DELETE http://localhost:3000/admin/rate-limiting/blacklist/10.0.0.50
```

### Viewing Metrics

```bash
# Get all metrics
curl http://localhost:3000/admin/rate-limiting/metrics

# Get system load metrics
curl http://localhost:3000/admin/rate-limiting/metrics/load

# Get user reputation
curl http://localhost:3000/admin/rate-limiting/reputation/user-123
```

## Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Rate Limiting Configuration
RATE_LIMIT_WHITELIST=192.168.1.1,10.0.0.1
RATE_LIMIT_WHITELIST_CIDR=10.0.0.0/8,192.168.0.0/16
RATE_LIMIT_BLACKLIST=1.2.3.4,5.6.7.8
RATE_LIMIT_BLACKLIST_CIDR=172.16.0.0/12
RATE_LIMIT_AUTO_BLACKLIST_THRESHOLD=10
RATE_LIMIT_AUTO_BLACKLIST_WINDOW=3600000
```

## Response Headers

All rate-limited endpoints return the following headers:

- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets

When rate limit is exceeded:
- `Retry-After`: Seconds to wait before retrying

## Error Response

When rate limit is exceeded (HTTP 429):

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "retryAfter": 45
}
```
