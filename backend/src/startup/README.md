# Startup Sequence Module

This module implements a comprehensive application startup sequence that ensures all dependencies are initialized in the correct order before the application starts serving requests.

## Features

- **Ordered Startup Phases**: Dependencies are initialized in 5 distinct phases
- **Dependency Verification**: Automatic verification of all critical dependencies
- **Health Probes**: Startup, readiness, and liveness probes for container orchestration
- **Graceful Shutdown**: Clean shutdown with proper resource cleanup
- **Startup Metrics**: Detailed timing and performance metrics
- **Comprehensive Testing**: Full test coverage for all startup scenarios

## Architecture

### Startup Phases

1. **Infrastructure** (`INFRASTRUCTURE`)
   - Database connection
   - Cache connection (Redis/BullMQ)
   - Timeout: 30s, Retry: 3 times

2. **Core Services** (`CORE`)
   - Configuration validation
   - Logging system
   - Timeout: 10s, Retry: 2 times

3. **Domain Services** (`DOMAIN`)
   - Agent service
   - Oracle service
   - Timeout: 15s, Retry: 3 times

4. **API Layer** (`API`)
   - Controllers and routes initialization
   - Timeout: 5s, Retry: 1 time

5. **External Integrations** (`EXTERNAL`)
   - Webhook system
   - External API connectivity
   - Timeout: 10s, Retry: 2 times

### Dependency Types

- `DATABASE`: Database connection (Critical)
- `CACHE`: Cache connection (Critical)
- `CONFIG`: Configuration validity (Critical)
- `LOGGING`: Logging system (Non-critical)
- `AGENT`: Agent service (Critical)
- `ORACLE`: Oracle service (Critical)
- `WEBHOOK`: Webhook system (Non-critical)
- `EXTERNAL_API`: External API connectivity (Non-critical)

## API Endpoints

### Health Probes

- `GET /health/startup` - Startup probe (returns 200 when ready, 503 when starting)
- `GET /health/readiness` - Readiness probe (checks all critical dependencies)
- `GET /health/liveness` - Liveness probe (simple process check)
- `GET /health` - Full health check with detailed dependency status

### Startup Management

- `GET /startup/status` - Current startup status and metrics
- `GET /startup/report` - Detailed startup report
- `GET /startup/metrics` - Startup timing metrics
- `GET /startup/validate` - Re-run startup validation

## Usage

### Integration

The startup module is automatically integrated into the application lifecycle:

1. **Module Import**: Added to `AppModule` as the first import
2. **Bootstrap Integration**: Main application waits for startup completion
3. **Graceful Shutdown**: Automatic cleanup on application termination

### Environment Variables

Required environment variables for dependency verification:

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=luminarytrade

# Cache (Redis)
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional
WEBHOOK_URL=https://your-webhook-url.com
EXTERNAL_API_URL=https://api.example.com
```

## Monitoring

### Startup Metrics

The system tracks:

- Total startup duration
- Phase-specific durations
- Dependency check durations
- Success/failure rates
- Warning counts

### Logging

Startup sequence provides detailed logging:

```
🔄 Waiting for startup sequence to complete...
🔧 Module initialization phase started
🏗️  Initializing infrastructure...
✅ Phase Infrastructure Setup completed in 500ms
⚙️  Initializing core services...
✅ Phase Core Services completed in 300ms
🚀 Application bootstrap phase started
✅ Startup validation completed successfully in 1000ms
```

## Testing

Run startup-specific tests:

```bash
# Run all startup tests
npm test -- --testPathPattern="startup" --coverage

# Run health probe tests
npm test -- --testPathPattern="health" --coverage

# Run dependency verification tests
npm test -- --testPathPattern="dependency" --coverage
```

### Test Coverage

- `startup-validator.service.spec.ts` - Startup phase validation
- `dependency-verification.service.spec.ts` - Dependency checking logic
- `startup.service.spec.ts` - Lifecycle hooks and graceful shutdown
- `health.controller.spec.ts` - Health probe endpoints

## Configuration

### Customizing Phases

You can customize phase configurations by modifying the `StartupValidatorService`:

```typescript
this.phaseConfigs.set(StartupPhase.INFRASTRUCTURE, {
  phase: StartupPhase.INFRASTRUCTURE,
  name: 'Infrastructure Setup',
  dependencies: [DependencyType.DATABASE, DependencyType.CACHE],
  timeout: 30000,  // Custom timeout
  retryAttempts: 3,  // Custom retry count
  retryDelay: 2000, // Custom retry delay
});
```

### Adding New Dependencies

1. Add to `DependencyType` enum
2. Implement check in `DependencyVerificationService`
3. Add to phase configuration
4. Update tests

## Troubleshooting

### Common Issues

1. **Startup Timeout**: Increase timeout values in phase configurations
2. **Dependency Failures**: Check environment variables and service availability
3. **Database Connection**: Verify database is running and credentials are correct
4. **Cache Connection**: Ensure Redis is accessible

### Debug Mode

Enable debug logging:

```typescript
// In main.ts
const app = await NestFactory.create(AppModule, {
  logger: ['debug', 'error', 'log', 'warn'],
});
```

### Health Check Status Codes

- `200`: Healthy/Ready
- `503`: Starting/Not Ready/Unhealthy/Shutting Down

## Best Practices

1. **Critical Dependencies**: Mark essential dependencies as critical
2. **Timeouts**: Set appropriate timeouts based on expected response times
3. **Retries**: Configure retries for transient failures
4. **Monitoring**: Monitor startup duration and failure rates
5. **Alerting**: Set up alerts for startup failures and slow startups

## Container Orchestration

### Kubernetes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5

startupProbe:
  httpGet:
    path: /health/startup
    port: 3000
  failureThreshold: 30
  periodSeconds: 10
```

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health/liveness || exit 1
```
