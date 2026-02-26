# Developer Guide: Creating Middleware

## Contract

Implement `IMiddleware`:

```ts
export interface IMiddleware {
  name: string;
  use(req, res, next): any;
  error?(err, req, res, next): any;
  when?(req): boolean;
  configure?(config): void;
}
```

## Steps

1. Create a class and implement `use` (and optional `error`)
2. Provide the class in `MiddlewarePipelineModule`
3. Register in `main.ts` via `MiddlewarePipeline`

## Conditional Wrapping

```ts
pipeline.useWhen((req) => req.path.startsWith('/admin'), adminMiddleware);
```

## Composition

Wrap third‑party Express middleware:

```ts
import { wrap } from './adapters/express-wrapper';
pipeline.register(wrap('helmet', helmet()));
```

## Error Handling

Add an `error` method to intercept errors before controllers:

```ts
error(err, req, res, next) {
  res.status(400).json({ success: false, error: { message: err.message } });
}
```

## Interceptors

Use `ResponseTransformInterceptor` as an example for response shaping and ordering with other global interceptors.
