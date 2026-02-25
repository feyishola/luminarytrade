# Event-Driven Architecture Implementation

## Overview

This implementation establishes a comprehensive event-driven architecture with event sourcing for the LuminaryTrade backend. The system replaces direct mutations with immutable events, providing complete audit trails, temporal queries, and reliable event propagation.

## Architecture Components

### 1. Event Store
- **Entity**: `EventStoreEntity` - Stores all domain events
- **Service**: `EventStore` - Handles CRUD operations for events
- **Features**:
  - Optimistic locking for consistency
  - Event snapshots for performance optimization
  - Event filtering and querying
  - Version control for aggregates

### 2. Event Bus
- **Interface**: `IEventBus` - Defines event bus contract
- **Implementation**: `NestEventBus` - NestJS-based event bus
- **Features**:
  - Async event handlers
  - Dead letter queue for failed events
  - Event retry with exponential backoff
  - Event tracing and monitoring

### 3. Domain Events
All critical operations emit domain events:

#### AI Result Events
- `AIResultCreatedEvent` - When AI scoring is initiated
- `AIResultCompletedEvent` - When AI scoring completes successfully
- `AIResultFailedEvent` - When AI scoring fails

#### Oracle Events
- `OracleSnapshotRecordedEvent` - When oracle snapshot is created
- `PriceFeedUpdatedEvent` - When price feed is updated

#### Audit Events
- `AuditLogCreatedEvent` - When audit log is created
- `UserAuthenticatedEvent` - When user authenticates

### 4. Saga Pattern
- **Base Class**: `Saga` - Abstract base for sagas
- **Manager**: `SagaManager` - Orchestrates saga execution
- **Persistence**: `TypeOrmSagaPersistence` - Stores saga state
- **Implementation**: `AIScoringSaga` - Coordinates AI scoring workflow

### 5. Event Replay & Snapshots
- **Service**: `EventReplayService` - Handles event replay functionality
- **Service**: `DefaultSnapshotService` - Manages aggregate snapshots
- **Features**:
  - Time-travel debugging
  - Event replay by type or aggregate
  - Snapshot creation and restoration
  - Batch processing capabilities

### 6. Monitoring & Metrics
- **Service**: `EventMonitoringService` - Collects event metrics
- **Collector**: `EventMetricsCollector` - Scheduled metrics collection
- **Features**:
  - Event processing times
  - Error rates and success rates
  - Dead letter queue monitoring
  - Health checks

## Event Flow

```
[Service] --> [Event Bus] --> [Event Store] --> [Event Handlers]
    |              |                |                |
    |              |                |                v
    |              |                |         [Read Models Update]
    |              |                |
    |              |                v
    |              |         [Saga Manager]
    |              |                |
    |              v                v
    |         [Dead Letter]   [Compensation]
    |              ^                ^
    |              |________________|
    |
    v
[Response]
```

## Key Benefits

### 1. Complete Audit Trail
- Every state change is recorded as an immutable event
- Full history of all aggregate changes
- Temporal queries and point-in-time reconstruction

### 2. Loose Coupling
- Services communicate through events
- No direct dependencies between services
- Easy to add new event handlers

### 3. Resilience
- Event retry mechanisms
- Dead letter queue for failed events
- Saga compensation for distributed transactions

### 4. Scalability
- Asynchronous event processing
- Event replay for system recovery
- Snapshot optimization for performance

## Configuration

### Environment Variables
```env
# Event Store
EVENT_STORE_CONNECTION_URL=postgresql://...
EVENT_STORE_MAX_CONNECTIONS=20

# Event Bus
EVENT_BUS_MAX_RETRIES=3
EVENT_BUS_RETRY_DELAY_MS=1000
EVENT_BUS_DEAD_LETTER_ENABLED=true

# Monitoring
EVENT_MONITORING_ENABLED=true
EVENT_METRICS_EXPORT_INTERVAL=3600000

# Snapshots
SNAPSHOT_INTERVAL_VERSIONS=100
SNAPSHOT_RETENTION_DAYS=30
```

### Module Registration
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventStoreEntity,
      EventSnapshot,
      SagaDataEntity,
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  providers: [
    EventStore,
    NestEventBus,
    EventReplayService,
    DefaultSnapshotService,
    SagaManager,
    TypeOrmSagaPersistence,
    AIScoringSaga,
    EventMonitoringService,
    EventMetricsCollector,
    {
      provide: 'EventBus',
      useExisting: NestEventBus,
    },
  ],
  exports: [
    EventStore,
    NestEventBus,
    EventReplayService,
    DefaultSnapshotService,
    SagaManager,
    EventMonitoringService,
  ],
})
export class EventModule {}
```

## Usage Examples

### Emitting Events
```typescript
@Injectable()
export class MyService {
  constructor(@Inject('EventBus') private eventBus: IEventBus) {}

  async performAction(data: any) {
    // Business logic here
    
    const event = new MyDomainEvent(
      aggregateId,
      aggregateType,
      payload,
    );
    
    await this.eventBus.publish(event);
  }
}
```

### Handling Events
```typescript
@Injectable()
export class MyEventHandler implements IEventHandler<MyDomainEvent> {
  async handle(event: MyDomainEvent): Promise<void> {
    // Process event
    console.log(`Handling event: ${event.eventType}`);
  }
}

// Register handler
eventBus.subscribe('MyDomainEvent', myEventHandler);
```

### Using Sagas
```typescript
@Injectable()
export class MySaga extends Saga {
  constructor(private eventBus: IEventBus) {
    super(sagaId, 'MySaga', initialData);
  }

  protected defineSteps(): void {
    this.addStep(
      'Step1',
      async () => {
        // Execute step 1
      },
      async () => {
        // Compensate step 1
      },
    );
    
    this.addStep(
      'Step2',
      async () => {
        // Execute step 2
      },
      async () => {
        // Compensate step 2
      },
    );
  }
}
```

## Testing

### Unit Tests
```bash
npm test -- --testPathPattern="event" --coverage
```

### Integration Tests
```bash
npm test -- --testPathPattern="integration" --coverage
```

### Event Replay Tests
```bash
npm test -- --testPathPattern="replay" --coverage
```

## Monitoring

### Metrics Available
- Event processing times
- Error rates by event type
- Dead letter queue size
- Active saga count
- Event store size

### Health Endpoints
```typescript
// Get system health
GET /api/events/health

// Get metrics
GET /api/events/metrics

// Get dead letter queue
GET /api/events/dead-letter
```

## Performance Considerations

### 1. Event Store Optimization
- Use database partitioning by timestamp
- Implement event archiving for old events
- Use snapshots for large aggregates

### 2. Event Bus Optimization
- Configure appropriate batch sizes
- Tune retry parameters
- Monitor dead letter queue

### 3. Snapshot Strategy
- Create snapshots every N events
- Use snapshots for aggregates with many events
- Implement snapshot compression

## Security

### 1. Event Validation
- Validate event schemas
- Implement event authorization
- Audit event access

### 2. Event Store Security
- Encrypt sensitive event data
- Implement access controls
- Audit event store access

## Migration Strategy

### Phase 1: Infrastructure Setup
1. Deploy event store tables
2. Configure event bus
3. Set up monitoring

### Phase 2: Service Integration
1. Update services to emit events
2. Implement event handlers
3. Add sagas for complex workflows

### Phase 3: Data Migration
1. Migrate existing data to event store
2. Create initial snapshots
3. Validate event replay

### Phase 4: Optimization
1. Tune performance
2. Optimize snapshots
3. Scale event processing

## Troubleshooting

### Common Issues

#### Event Not Processed
1. Check event bus configuration
2. Verify handler registration
3. Check dead letter queue

#### Slow Event Processing
1. Monitor processing times
2. Check database performance
3. Optimize handler logic

#### Saga Failures
1. Check saga state in database
2. Verify compensation logic
3. Review error logs

### Debug Tools
- Event replay functionality
- Snapshot inspection
- Metrics dashboard
- Health check endpoints

## Future Enhancements

### 1. Event Sourcing Extensions
- Event versioning
- Event schema evolution
- Cross-aggregate transactions

### 2. Advanced Monitoring
- Real-time dashboards
- Alerting on anomalies
- Performance analytics

### 3. Event Store Features
- Event compression
- Distributed event store
- Event streaming integration

This implementation provides a robust foundation for event-driven architecture with comprehensive event sourcing capabilities, ensuring reliability, auditability, and scalability for the LuminaryTrade platform.
