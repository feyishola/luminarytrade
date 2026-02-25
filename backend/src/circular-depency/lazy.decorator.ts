import { Inject } from '@nestjs/common';
import { LAZY_INJECT_TOKEN } from '../circular-dependency/constants';

/**
 * @Lazy() decorator - marks an injection as lazy (resolved on first access).
 * Use this for circular dependencies to break initialization cycles.
 *
 * Example:
 *   constructor(@Lazy(() => OrderService) private orderService: OrderService) {}
 */
export function Lazy(typeOrToken: (() => any) | string | symbol): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const existingLazyMeta: Map<number, () => any> =
      Reflect.getMetadata(LAZY_INJECT_TOKEN, target) || new Map();

    const resolvedToken =
      typeof typeOrToken === 'function'
        ? typeOrToken
        : () => typeOrToken;

    existingLazyMeta.set(parameterIndex, resolvedToken);
    Reflect.defineMetadata(LAZY_INJECT_TOKEN, existingLazyMeta, target);

    // Inject a lazy wrapper instead of the real service
    return Inject(`LAZY_${String(typeof typeOrToken === 'function' ? typeOrToken.name : typeOrToken)}`)(
      target,
      propertyKey,
      parameterIndex,
    );
  };
}

/**
 * @InjectLazy() - alternative explicit form for named tokens.
 *
 * Example:
 *   constructor(@InjectLazy('ORDER_SERVICE') private orderService: any) {}
 */
export function InjectLazy(token: string | symbol): ParameterDecorator {
  return Inject(`LAZY_${String(token)}`);
}
