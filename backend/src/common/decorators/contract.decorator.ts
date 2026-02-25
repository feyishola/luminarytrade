import { Logger } from '@nestjs/common';
import { ServiceContract } from '../services/base-service.interface';

/**
 * Contract enforcement decorator
 * Validates method preconditions, postconditions, and invariants at runtime
 * Only active in development environment
 */
export function Contract(contract: ServiceContract) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const isDev = process.env.NODE_ENV === 'development';
    const logger = new Logger('ContractValidator');

    descriptor.value = function (...args: any[]) {
      // Skip contract validation in production for performance
      if (!isDev) {
        return method.apply(this, args);
      }

      try {
        // Validate preconditions
        if (contract.preconditions && contract.preconditions.length > 0) {
          validatePreconditions(contract.preconditions, args, this);
        }

        // Execute method
        const result = method.apply(this, args);

        // Handle async methods
        if (result instanceof Promise) {
          return result.then((resolvedResult) => {
            validatePostconditions(contract.postconditions, resolvedResult, this);
            validateInvariants(contract.invariants, this);
            return resolvedResult;
          }).catch((error) => {
            validateExceptions(contract.exceptions, error, this);
            throw error;
          });
        } else {
          // Handle sync methods
          validatePostconditions(contract.postconditions, result, this);
          validateInvariants(contract.invariants, this);
          return result;
        }
      } catch (error) {
        validateExceptions(contract.exceptions, error, this);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Validate method preconditions
 */
function validatePreconditions(
  preconditions: string[],
  args: any[],
  context: any
): void {
  const logger = new Logger('PreconditionValidator');
  
  for (const condition of preconditions) {
    try {
      // Simple condition evaluation - in production, use a proper expression parser
      const isValid = evaluateCondition(condition, args, context);
      if (!isValid) {
        const error = new Error(`Precondition failed: ${condition}`);
        logger.error(`Contract violation - ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to evaluate precondition '${condition}':`, error);
      throw new Error(`Invalid precondition: ${condition}`);
    }
  }
}

/**
 * Validate method postconditions
 */
function validatePostconditions(
  postconditions: string[],
  result: any,
  context: any
): void {
  const logger = new Logger('PostconditionValidator');
  
  for (const condition of postconditions) {
    try {
      const isValid = evaluateCondition(condition, [result], context);
      if (!isValid) {
        const error = new Error(`Postcondition failed: ${condition}`);
        logger.error(`Contract violation - ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to evaluate postcondition '${condition}':`, error);
      throw new Error(`Invalid postcondition: ${condition}`);
    }
  }
}

/**
 * Validate service invariants
 */
function validateInvariants(
  invariants: string[],
  context: any
): void {
  const logger = new Logger('InvariantValidator');
  
  for (const invariant of invariants) {
    try {
      const isValid = evaluateCondition(invariant, [], context);
      if (!isValid) {
        const error = new Error(`Invariant violated: ${invariant}`);
        logger.error(`Contract violation - ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to evaluate invariant '${invariant}':`, error);
      throw new Error(`Invalid invariant: ${invariant}`);
    }
  }
}

/**
 * Validate expected exceptions
 */
function validateExceptions(
  exceptions: Array<{ type: string; condition: string; recovery: string }>,
  error: any,
  context: any
): void {
  const logger = new Logger('ExceptionValidator');
  
  // Check if this error type is expected
  const expectedException = exceptions.find(e => 
    error.constructor.name === e.type || error.name === e.type
  );
  
  if (!expectedException) {
    logger.warn(`Unexpected exception type: ${error.constructor.name}`);
    return;
  }
  
  // Validate exception condition if specified
  if (expectedException.condition) {
    try {
      const conditionMet = evaluateCondition(expectedException.condition, [error], context);
      if (!conditionMet) {
        logger.warn(`Exception condition not met for ${expectedException.type}`);
      }
    } catch (conditionError) {
      logger.error(`Failed to evaluate exception condition:`, conditionError);
    }
  }
  
  logger.debug(`Expected exception handled: ${expectedException.type}`);
}

/**
 * Simple condition evaluation (for demonstration)
 * In production, use a proper expression parser like jsep or similar
 */
function evaluateCondition(
  condition: string,
  args: any[],
  context: any
): boolean {
  // This is a simplified implementation
  // In production, use a proper expression evaluator
  
  try {
    // Handle common patterns
    if (condition.includes('!= null')) {
      const varName = condition.split('!= null')[0].trim();
      return getVariableValue(varName, args, context) != null;
    }
    
    if (condition.includes('=== true')) {
      const varName = condition.split('=== true')[0].trim();
      return getVariableValue(varName, args, context) === true;
    }
    
    if (condition.includes('> 0')) {
      const varName = condition.split('> 0')[0].trim();
      const value = getVariableValue(varName, args, context);
      return typeof value === 'number' && value > 0;
    }
    
    if (condition.includes('.length > 0')) {
      const varName = condition.split('.length > 0')[0].trim();
      const value = getVariableValue(varName, args, context);
      return Array.isArray(value) && value.length > 0;
    }
    
    // Default: try to evaluate as boolean expression
    return !!getVariableValue(condition, args, context);
  } catch (error) {
    throw new Error(`Failed to evaluate condition: ${condition}`);
  }
}

/**
 * Get variable value from args or context
 */
function getVariableValue(
  varName: string,
  args: any[],
  context: any
): any {
  // Check if it's a method parameter (arg0, arg1, etc.)
  if (varName.startsWith('arg')) {
    const index = parseInt(varName.substring(3));
    return args[index];
  }
  
  // Check if it's a property of the context
  if (varName in context) {
    return context[varName];
  }
  
  // Check if it's a nested property
  if (varName.includes('.')) {
    return varName.split('.').reduce((obj, prop) => obj?.[prop], context);
  }
  
  // Try to find in args
  for (const arg of args) {
    if (arg && typeof arg === 'object' && varName in arg) {
      return arg[varName];
    }
  }
  
  return undefined;
}

/**
 * Performance monitoring decorator
 * Tracks method execution time and validates performance contracts
 */
export function Performance(contract: ServiceContract) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    const logger = new Logger('PerformanceMonitor');

    descriptor.value = function (...args: any[]) {
      const startTime = process.hrtime.bigint();
      
      const result = method.apply(this, args);
      
      if (result instanceof Promise) {
        return result.then((resolvedResult) => {
          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1000000; // Convert to ms
          
          validatePerformance(contract.performance, duration, propertyName);
          return resolvedResult;
        });
      } else {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to ms
        
        validatePerformance(contract.performance, duration, propertyName);
        return result;
      }
    };

    return descriptor;
  };
}

/**
 * Validate performance characteristics
 */
function validatePerformance(
  performance: { expectedLatency: string; maxLatency: string; throughput: string },
  actualDuration: number,
  methodName: string
): void {
  const logger = new Logger('PerformanceValidator');
  
  // Parse max latency (e.g., "100ms" -> 100)
  const maxLatency = parseInt(performance.maxLatency.replace('ms', ''));
  
  if (actualDuration > maxLatency) {
    logger.warn(
      `Performance violation in ${methodName}: ` +
      `expected <= ${maxLatency}ms, actual: ${actualDuration.toFixed(2)}ms`
    );
  }
}