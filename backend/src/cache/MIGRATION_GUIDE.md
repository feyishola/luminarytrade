# Cache Implementation Migration Guide

This guide helps you add caching to existing services in your application.

## Quick Start

### Step 1: Import CacheModule

Add `CacheModule` to your module's imports:

```typescript
import { CacheModule } from "../cache/cache.module";

@Module({
  imports: [
    // ... other imports
    CacheModule,
  ],
  // ...
})
export class YourModule {}
```

### Step 2: Inject Cache Services

Add cache services to your service constructor:

```typescript
import { CacheManager } from "../cache/cache-manager.service";
import { CacheInvalidator } from "../cache/cache-invalidator.service";

@Injectable()
export class YourService {
  constructor(
    // ... existing dependencies
    private readonly cacheManager: CacheManager,
    private readonly cacheInvalidator: CacheInvalidator,
  ) {}
}
```

### Step 3: Add Decorators

#### For Read Operations (GET)

Add `@Cacheable()` decorator:

```typescript
// Before
async getTopPerformers(limit: number = 10): Promise<Agent[]> {
  return await this.repository
    .createQueryBuilder('agent')
    .orderBy("(agent.performance_metrics->>'success_rate')::float", 'DESC')
    .limit(limit)
    .getMany();
}

// After
@Cacheable({
  key: (limit: number = 10) => `top-performers:${limit}`,
  ttl: 300, // 5 minutes
  namespace: 'agent',
})
async getTopPerformers(limit: number = 10): Promise<Agent[]> {
  return await this.repository
    .createQueryBuilder('agent')
    .orderBy("(agent.performance_metrics->>'success_rate')::float", 'DESC')
    .limit(limit)
    .getMany();
}
```

#### For Write Operations (POST, PUT, DELETE)

Add `@CacheInvalidate()` decorator:

```typescript
// Before
async create(createDto: CreateAgentDto): Promise<Agent> {
  const agent = this.repository.create(createDto);
  return await this.repository.save(agent);
}

// After
@CacheInvalidate({ rule: 'agent:create' })
async create(createDto: CreateAgentDto): Promise<Agent> {
  const agent = this.repository.create(createDto);
  return await this.repository.save(agent);
}
```

## Common Patterns

### Pattern 1: Simple Read with Cache

```typescript
@Cacheable({
  key: 'all-users',
  ttl: 600,
  namespace: 'user',
})
async findAll(): Promise<User[]> {
  return await this.repository.find();
}
```

### Pattern 2: Parameterized Cache Key

```typescript
@Cacheable({
  key: (id: string) => `user:${id}`,
  ttl: 600,
  namespace: 'user',
})
async findOne(id: string): Promise<User> {
  return await this.repository.findOne({ where: { id } });
}
```

### Pattern 3: Complex Cache Key

```typescript
@Cacheable({
  key: (filters: SearchDto) => `search:${JSON.stringify(filters)}`,
  ttl: 300,
  namespace: 'user',
})
async search(filters: SearchDto): Promise<User[]> {
  return await this.repository.find({ where: filters });
}
```

### Pattern 4: Conditional Caching

```typescript
@Cacheable({
  key: (id: string) => `user:${id}`,
  ttl: 600,
  namespace: 'user',
  condition: (id: string) => id !== 'admin', // Don't cache admin user
})
async findOne(id: string): Promise<User> {
  return await this.repository.findOne({ where: { id } });
}
```

### Pattern 5: Write with Invalidation

```typescript
@CacheInvalidate({
  rule: 'user:update',
  keys: (id: string) => [`user:${id}`],
})
async update(id: string, updateDto: UpdateUserDto): Promise<User> {
  await this.repository.update(id, updateDto);
  return await this.findOne(id);
}
```

### Pattern 6: Multiple Invalidations

```typescript
@CacheInvalidate({
  keys: (id: string) => [`user:${id}`, `user-profile:${id}`],
  patterns: ['users:*', 'user-list:*'],
  namespace: 'user',
})
async delete(id: string): Promise<void> {
  await this.repository.delete(id);
}
```

## Invalidation Rules Setup

### Step 1: Register Custom Rules

In your service's constructor or module initialization:

```typescript
constructor(
  private readonly cacheInvalidator: CacheInvalidator,
) {
  this.registerInvalidationRules();
}

private registerInvalidationRules(): void {
  this.cacheInvalidator.registerRule('user:create', {
    patterns: ['users:*', 'user-list:*'],
    namespace: 'user',
  });

  this.cacheInvalidator.registerRule('user:update', {
    patterns: ['users:*', 'user-list:*'],
    namespace: 'user',
  });

  this.cacheInvalidator.registerRule('user:delete', {
    patterns: ['user:*', 'users:*', 'user-list:*'],
    namespace: 'user',
  });
}
```

### Step 2: Use Rules in Decorators

```typescript
@CacheInvalidate({ rule: 'user:create' })
async create(dto: CreateUserDto): Promise<User> {
  // ...
}

@CacheInvalidate({ rule: 'user:update' })
async update(id: string, dto: UpdateUserDto): Promise<User> {
  // ...
}

@CacheInvalidate({ rule: 'user:delete' })
async delete(id: string): Promise<void> {
  // ...
}
```

## Manual Cache Operations

For cases where decorators aren't suitable:

### Manual Get/Set

```typescript
async getUser(id: string): Promise<User> {
  const cacheKey = `user:${id}`;

  // Try to get from cache
  const cached = await this.cacheManager.get<User>(cacheKey, {
    namespace: 'user',
  });

  if (cached) {
    return cached;
  }

  // Fetch from database
  const user = await this.repository.findOne({ where: { id } });

  // Store in cache
  await this.cacheManager.set(cacheKey, user, {
    ttl: 600,
    namespace: 'user',
  });

  return user;
}
```

### Manual Invalidation

```typescript
async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
  const user = await this.repository.save({ id, ...dto });

  // Invalidate specific key
  await this.cacheInvalidator.invalidateKey(`user:${id}`, 'user');

  // Invalidate pattern
  await this.cacheInvalidator.invalidatePattern('users:*', 'user');

  return user;
}
```

### Get or Set Pattern

```typescript
async getUser(id: string): Promise<User> {
  return await this.cacheManager.getOrSet(
    `user:${id}`,
    () => this.repository.findOne({ where: { id } }),
    { ttl: 600, namespace: 'user' }
  );
}
```

## Cache Warming

Add cache warming for critical queries:

```typescript
async onModuleInit() {
  await this.warmCache();
}

async warmCache(): Promise<void> {
  // Warm top users cache
  await this.cacheManager.warm(
    'top-users:10',
    () => this.getTopUsers(10),
    { ttl: 300, namespace: 'user' }
  );

  // Warm active users cache
  await this.cacheManager.warm(
    'active-users',
    () => this.getActiveUsers(),
    { ttl: 600, namespace: 'user' }
  );
}
```

## Testing

### Unit Tests

```typescript
describe("UserService - Caching", () => {
  let service: UserService;
  let cacheManager: CacheManager;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: CacheManager,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        // ... other providers
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    cacheManager = module.get<CacheManager>(CacheManager);
  });

  it("should cache user on first call", async () => {
    (cacheManager.get as jest.Mock).mockResolvedValue(null);

    await service.findOne("123");

    expect(cacheManager.set).toHaveBeenCalledWith(
      "user:123",
      expect.any(Object),
      { ttl: 600, namespace: "user" },
    );
  });

  it("should return cached user on second call", async () => {
    const cachedUser = { id: "123", name: "Test" };
    (cacheManager.get as jest.Mock).mockResolvedValue(cachedUser);

    const result = await service.findOne("123");

    expect(result).toEqual(cachedUser);
  });
});
```

## Checklist

- [ ] Import CacheModule in your module
- [ ] Inject CacheManager and CacheInvalidator in your service
- [ ] Add @Cacheable() to read operations
- [ ] Add @CacheInvalidate() to write operations
- [ ] Register custom invalidation rules
- [ ] Add cache warming for critical queries
- [ ] Write tests for caching behavior
- [ ] Monitor cache metrics
- [ ] Document cache strategy in service

## Troubleshooting

### Decorators not working

Make sure:

1. CacheModule is imported in your module
2. Services are injected in constructor
3. Decorators are imported from correct path
4. Method is async

### Cache not invalidating

Check:

1. Invalidation rule is registered
2. Rule name matches in decorator
3. Patterns match your cache keys
4. Namespace is consistent

### Performance issues

Consider:

1. Reducing TTL for frequently changing data
2. Using more specific cache keys
3. Implementing cache size limits
4. Monitoring cache hit rates

## Next Steps

1. Review cache metrics regularly
2. Adjust TTL based on data freshness requirements
3. Optimize invalidation rules
4. Consider Redis for distributed caching
5. Implement cache preloading strategies
