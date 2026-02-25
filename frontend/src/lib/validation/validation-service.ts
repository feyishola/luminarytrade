import {
  Validator,
  ValidationErrors,
  ValidationSchema,
  ValidationOptions,
  ValidationResult,
  FieldValidatorConfig,
} from './types';

// Import validators directly
import {
  required as requiredValidator,
  email as emailValidator,
  minLength as minLengthValidator,
  maxLength as maxLengthValidator,
  min as minValidator,
  max as maxValidator,
  pattern as patternValidator,
  url as urlValidator,
  number as numberValidator,
} from './validators';

import {
  stellarAddress as stellarAddressValidator,
  transactionHash as transactionHashValidator,
  assetCode as assetCodeValidator,
  amount as amountValidator,
} from './blockchain-validators';

/**
 * Main validation service class
 */
export class ValidationService {
  /**
   * Validate a single field against multiple validators
   */
  static async validateField<T>(
    value: T,
    validators: Validator<T>[],
    formData?: Record<string, any>,
    fieldName?: string,
  ): Promise<ValidationResult> {
    for (const validator of validators) {
      const result = await validator(value, formData, fieldName);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  }

  /**
   * Validate an entire form using a schema
   */
  static async validateForm<T extends Record<string, any>>(
    data: T,
    schema: ValidationSchema<T>,
    options: ValidationOptions = {},
  ): Promise<ValidationErrors<T>> {
    const { stopOnFirstError = false, validateAllFields = true } = options;
    const errors: ValidationErrors<T> = {};

    const entries = Object.entries(schema) as [keyof T, any][];

    for (const [fieldName, fieldConfig] of entries) {
      // Skip validation if field is not in data
      if (!(fieldName in data)) continue;

      // Skip conditional fields that don't meet condition
      if (fieldConfig.conditional && !fieldConfig.conditional(data)) {
        continue;
      }

      const value = data[fieldName];

      // Validate with synchronous validators first
      if (fieldConfig.validators && fieldConfig.validators.length > 0) {
        const fieldResult = await this.validateField(
          value,
          fieldConfig.validators,
          data,
          String(fieldName),
        );

        if (!fieldResult.valid) {
          errors[fieldName] = fieldResult;
          
          if (stopOnFirstError) {
            return errors;
          }
          
          // Continue to next field if not validating all fields
          if (!validateAllFields) {
            continue;
          }
        }
      }
    }

    // Handle async validators separately
    const asyncValidations: Promise<[string, ValidationResult]>[] = [];
    
    for (const [fieldName, fieldConfig] of entries) {
      if (fieldConfig.asyncValidators && fieldConfig.asyncValidators.length > 0) {
        const value = data[fieldName];
        
        // Only run async validation if sync validation passed
        if (!errors[fieldName]) {
          const asyncValidation = this.validateField(
            value,
            fieldConfig.asyncValidators,
            data,
            String(fieldName),
          ).then(result => [String(fieldName), result] as [string, ValidationResult]);
          
          asyncValidations.push(asyncValidation);
        }
      }
    }

    // Wait for all async validations to complete
    if (asyncValidations.length > 0) {
      const asyncResults = await Promise.all(asyncValidations);
      
      for (const [fieldName, result] of asyncResults) {
        if (!result.valid) {
          errors[fieldName as keyof T] = result;
        }
      }
    }

    return errors;
  }

  /**
   * Create a validation schema from field configuration
   */
  static createSchema<T extends Record<string, any>>(
    config: { [K in keyof T]?: FieldValidatorConfig<T[K]> },
  ): ValidationSchema<T> {
    const schema: ValidationSchema<T> = {};

    for (const [fieldName, fieldConfig] of Object.entries(config)) {
      if (fieldConfig) {
        const validators: Validator<any>[] = [];
        const asyncValidators: Validator<any>[] = [];

        // Add required validator if specified
        if (fieldConfig.required) {
          const message = typeof fieldConfig.required === 'string' 
            ? fieldConfig.required 
            : undefined;
          validators.push(requiredValidator(message));
        }

        // Add email validator if specified
        if (fieldConfig.email) {
          const message = typeof fieldConfig.email === 'string' 
            ? fieldConfig.email 
            : undefined;
          validators.push(emailValidator(message));
        }

        // Add min length validator if specified
        if (fieldConfig.minLength !== undefined) {
          const minLength = typeof fieldConfig.minLength === 'object' 
            ? fieldConfig.minLength.value 
            : fieldConfig.minLength;
          const message = typeof fieldConfig.minLength === 'object' 
            ? fieldConfig.minLength.message 
            : undefined;
          validators.push(minLengthValidator(minLength, message));
        }

        // Add max length validator if specified
        if (fieldConfig.maxLength !== undefined) {
          const maxLength = typeof fieldConfig.maxLength === 'object' 
            ? fieldConfig.maxLength.value 
            : fieldConfig.maxLength;
          const message = typeof fieldConfig.maxLength === 'object' 
            ? fieldConfig.maxLength.message 
            : undefined;
          validators.push(maxLengthValidator(maxLength, message));
        }

        // Add min value validator if specified
        if (fieldConfig.min !== undefined) {
          const minValue = typeof fieldConfig.min === 'object' 
            ? fieldConfig.min.value 
            : fieldConfig.min;
          const message = typeof fieldConfig.min === 'object' 
            ? fieldConfig.min.message 
            : undefined;
          validators.push(minValidator(minValue, message));
        }

        // Add max value validator if specified
        if (fieldConfig.max !== undefined) {
          const maxValue = typeof fieldConfig.max === 'object' 
            ? fieldConfig.max.value 
            : fieldConfig.max;
          const message = typeof fieldConfig.max === 'object' 
            ? fieldConfig.max.message 
            : undefined;
          validators.push(maxValidator(maxValue, message));
        }

        // Add pattern validator if specified
        if (fieldConfig.pattern) {
          const pattern = typeof fieldConfig.pattern === 'object' 
            ? fieldConfig.pattern.value 
            : fieldConfig.pattern;
          const message = typeof fieldConfig.pattern === 'object' 
            ? fieldConfig.pattern.message 
            : undefined;
          validators.push(patternValidator(pattern, message));
        }

        // Add URL validator if specified
        if (fieldConfig.url) {
          const message = typeof fieldConfig.url === 'string' 
            ? fieldConfig.url 
            : undefined;
          validators.push(urlValidator(message));
        }

        // Add number validator if specified
        if (fieldConfig.number) {
          const message = typeof fieldConfig.number === 'string' 
            ? fieldConfig.number 
            : undefined;
          validators.push(numberValidator(message));
        }

        // Add custom validators
        if (fieldConfig.custom) {
          const customValidators = Array.isArray(fieldConfig.custom) 
            ? fieldConfig.custom 
            : [fieldConfig.custom];
          validators.push(...customValidators);
        }

        // Add async validators
        if (fieldConfig.async) {
          const asyncVal = Array.isArray(fieldConfig.async) 
            ? fieldConfig.async 
            : [fieldConfig.async];
          asyncValidators.push(...asyncVal);
        }

        // Add validate function if provided
        if (fieldConfig.validate) {
          validators.push(fieldConfig.validate);
        }

        schema[fieldName as keyof T] = {
          field: fieldName as keyof T,
          validators,
          ...(asyncValidators.length > 0 && { asyncValidators }),
        };
      }
    }

    return schema;
  }

  // Convenience methods for common validators
  static required = requiredValidator;
  static email = emailValidator;
  static minLength = minLengthValidator;
  static maxLength = maxLengthValidator;
  static min = minValidator;
  static max = maxValidator;
  static pattern = patternValidator;
  static url = urlValidator;
  static number = numberValidator;

  // Blockchain validators
  static stellarAddress = stellarAddressValidator;
  static transactionHash = transactionHashValidator;
  static assetCode = assetCodeValidator;
  static amount = amountValidator;
}

/**
 * Higher-order function to create a form validator
 */
export function createFormValidator<T extends Record<string, any>>(
  schema: ValidationSchema<T>,
  options: ValidationOptions = {},
) {
  return async (data: T): Promise<ValidationErrors<T>> => {
    return ValidationService.validateForm(data, schema, options);
  };
}

/**
 * Hook up commonly used validators for convenience
 */
export const {
  required,
  email,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  url,
  number,
  stellarAddress,
  transactionHash,
  assetCode,
  amount,
} = ValidationService;