# Middleware Pipeline

Composable middleware pipeline with interceptor integration for NestJS (Express).

## Features

- Composable `IMiddleware` contract with `use`, optional `error`, `when`, `configure`
- Pipeline builder with registration, conditional middleware, and reordering
- Composition of external Express handlers via adapters
- Core middlewares: Authentication, Logging, Validation, Rate Limit, CORS, Error Handling
- Interceptor integration with global response transformation
- Lazy initialization and cached composition

## Usage

```ts
const pipeline = app.get(MiddlewarePipeline);
const logging = app.get(LoggingMiddleware);
const auth = app.get(AuthenticationMiddleware);
const validation = app.get(ValidationMiddleware);
const rate = app.get(RateLimitMiddleware);
const cors = app.get(CorsMiddleware);
const errorHandler = app.get(ErrorHandlingMiddleware);

rate.configure({ block: false });

pipeline
  .register(cors)
  .register(logging)
  .useWhen((req) => !!req.headers.authorization, auth)
  .register(validation)
  .register(rate)
  .register(errorHandler);

app.use(pipeline.build());
```

## Composition

- `register(mw)` adds middleware at the end
- `useWhen(cond, mw)` wraps middleware with a predicate
- `insertBefore(name, mw)` and `insertAfter(name, mw)` to adjust order
- `reorder([...names])` to define a preferred order

## Interceptors

Register global interceptors in `main.ts`:

```ts
const tracing = app.get(TracingInterceptor);
const transform = app.get(ResponseTransformInterceptor);
app.useGlobalInterceptors(tracing, transform);
```

## Testing

- Pipeline composition tests: `middleware-pipeline/__tests__/pipeline.composition.spec.ts`
- Performance test: `middleware-pipeline/__tests__/pipeline.performance.spec.ts`
- Run: `npm test -- --testPathPattern="middleware|pipeline" --coverage`
- Perf: `npm run test:performance -- --middleware`

## Examples

See `main.ts` for integration and the tests for composition examples.
