# Caching Strategy

This module implements a comprehensive caching strategy with TTL support, cache invalidation, and metrics tracking.

## Features

- **TTL-based caching**: Automatic expiration of cached data
- **Namespace support**: Organize cache keys by domain
- **Cache invalidation**: Rule-based and pattern-based invalidation
- **Metrics tracking**: Monitor cache hit/miss rates
- **Decorators**: Easy-to-use `@Cacheable()` and `@CacheInvalidate()` decorators
- **Cache warming**: Pre-populate cache for critical queries

## Architecture

### Core Services

1. **CacheManager**: Main service for cache operations (get, set, delete)
2. **CacheInvalidator**: Handles cache invalidation strategies
3. **CacheMetricsService**: Tracks cache performance metrics

### Decorators

#### @Cacheable()

Marks a method as cacheable. Results are automatically cached and retrieved on subsequent calls.

```typescript
@Cacheable({
  key: 'top-performers',
  ttl: 300, // 5 minutes
  namespace: 'agent',
})
async getTopPerformers(limit: number): Promise<Agent[]> {
  // Method implementation
}
```

Options:

- `key`: Static string or function to generate cache key
- `ttl`: Time to live in seconds
- `namespace`: Cache key namespace
- `condition`: Function to determine if result should be cached

#### @CacheInvalidate()

Invalidates cache after method execution (or before, if specified).

```typescript
@CacheInvalidate({ rule: 'agent:create' })
async create(dto: CreateAgentDto): Promise<Agent> {
  // Method implementation
}
```

Options:

- `rule`: Invalidation rule name
- `keys`: Specific keys to invalidate
- `patterns`: Key patterns to invalidate
- `namespace`: Cache namespace
- `when`: 'before' or 'after' method execution

## Usage

### 1. Import CacheModule

```typescript
import { CacheModule } from "../cache/cache.module";

@Module({
  imports: [CacheModule],
  // ...
})
export class YourModule {}
```

### 2. Inject Services

```typescript
constructor(
  private readonly cacheManager: CacheManager,
  private readonly cacheInvalidator: CacheInvalidator,
) {}
```

### 3. Use Decorators

```typescript
@Cacheable({
  key: (id: string) => `agent:${id}`,
  ttl: 600,
  namespace: 'agent',
})
async findOne(id: string): Promise<Agent> {
  return await this.repository.findOne({ where: { id } });
}

@CacheInvalidate({
  rule: 'agent:update',
  keys: (id: string) => [`agent:${id}`],
})
async update(id: string, dto: UpdateAgentDto): Promise<Agent> {
  return await this.repository.save({ id, ...dto });
}
```

## Invalidation Rules

Pre-configured invalidation rules:

### Agent Rules

- `agent:create`: Invalidates all agent lists and top performers
- `agent:update`: Invalidates specific agent and related lists
- `agent:delete`: Invalidates all agent-related caches
- `agent:performance-update`: Invalidates top performers and specific agent

### Oracle Rules

- `oracle:snapshot`: Invalidates latest prices and snapshots
- `oracle:price-update`: Invalidates latest prices and specific price feeds

### Custom Rules

Register custom invalidation rules:

```typescript
cacheInvalidator.registerRule("custom:rule", {
  patterns: ["custom:*", "related:*"],
  namespace: "custom",
});
```

## Cache Warming

Pre-populate cache for critical queries:

```typescript
async warmCache(): Promise<void> {
  await this.cacheManager.warm(
    'top-performers:10',
    () => this.getTopPerformers(10),
    { ttl: 300, namespace: 'agent' }
  );
}
```

## Monitoring

### Cache Metrics

Access cache metrics via the API:

```bash
# Get overall metrics
GET /cache/metrics

# Get metrics for specific key
GET /cache/metrics/agent:top-performers:10
```

Response:

```json
{
  "hits": 150,
  "misses": 50,
  "hitRate": 75.0,
  "totalRequests": 200
}
```

### Cache Management

```bash
# Clear all cache
DELETE /cache/clear

# Invalidate by pattern
DELETE /cache/pattern/agents:*

# Invalidate specific key
DELETE /cache/key/agent:123

# Reset metrics
DELETE /cache/metrics
```

## Best Practices

1. **Choose appropriate TTL**: Balance freshness vs performance
   - Frequently changing data: 60-300 seconds
   - Stable data: 600-3600 seconds
   - Static data: 3600+ seconds

2. **Use namespaces**: Organize cache keys by domain

   ```typescript
   {
     namespace: "agent";
   } // agent:key
   {
     namespace: "oracle";
   } // oracle:key
   ```

3. **Invalidate on mutations**: Always invalidate related caches

   ```typescript
   @CacheInvalidate({ rule: 'agent:update' })
   async update() { ... }
   ```

4. **Cache key generation**: Use descriptive, unique keys

   ```typescript
   key: (id: string, type: string) => `${type}:${id}`;
   ```

5. **Conditional caching**: Skip cache for specific conditions

   ```typescript
   condition: (id: string) => id !== "skip-cache";
   ```

6. **Monitor metrics**: Track hit rates and adjust strategy
   ```typescript
   const metrics = await cacheMetricsService.getMetrics();
   console.log(`Hit rate: ${metrics.hitRate}%`);
   ```

## Configuration

Configure cache settings in `cache.module.ts`:

```typescript
NestCacheModule.register({
  ttl: 300, // Default TTL in seconds
  max: 1000, // Maximum cache items
  isGlobal: true, // Make cache available globally
});
```

## Testing

Run cache tests:

```bash
npm test -- cache
```

Test files:

- `cache-manager.service.spec.ts`: CacheManager unit tests
- `cache-invalidator.service.spec.ts`: CacheInvalidator unit tests
- `indexer.service.cache.spec.ts`: Integration tests with IndexerService

## Performance Impact

Expected improvements:

- **Read operations**: 80-95% faster for cached data
- **Database load**: 60-80% reduction in query volume
- **API response time**: 50-70% improvement for cached endpoints

## Troubleshooting

### Cache not working

1. Verify CacheModule is imported
2. Check services are injected correctly
3. Ensure decorators are applied to methods
4. Verify cache key generation

### High miss rate

1. Check TTL is not too short
2. Verify invalidation rules are not too aggressive
3. Review cache key generation logic
4. Monitor cache size limits

### Memory issues

1. Reduce `max` cache items
2. Lower TTL values
3. Implement cache eviction strategy
4. Consider Redis for distributed caching

## Future Enhancements

- [ ] Redis integration for distributed caching
- [ ] Cache compression for large objects
- [ ] Advanced eviction strategies (LRU, LFU)
- [ ] Cache preloading on application startup
- [ ] Distributed cache invalidation
- [ ] Cache versioning for schema changes
