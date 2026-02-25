import {
  ValidationResult,
  Validator,
  ValidationErrorCode,
  ErrorMessageMap,
} from './types';

// Default error messages
const defaultMessages: ErrorMessageMap = {
  [ValidationErrorCode.REQUIRED]: (fieldName) => `${fieldName || 'This field'} is required`,
  [ValidationErrorCode.EMAIL]: () => 'Please enter a valid email address',
  [ValidationErrorCode.MIN_LENGTH]: (_, params) => `Must be at least ${params} characters`,
  [ValidationErrorCode.MAX_LENGTH]: (_, params) => `Must be no more than ${params} characters`,
  [ValidationErrorCode.MIN_VALUE]: (_, params) => `Must be at least ${params}`,
  [ValidationErrorCode.MAX_VALUE]: (_, params) => `Must be no more than ${params}`,
  [ValidationErrorCode.NUMBER]: () => 'Must be a valid number',
  [ValidationErrorCode.URL]: () => 'Please enter a valid URL',
  [ValidationErrorCode.PATTERN]: () => 'Invalid format',
  [ValidationErrorCode.STELLAR_ADDRESS]: () => 'Invalid Stellar address',
  [ValidationErrorCode.TRANSACTION_HASH]: () => 'Invalid transaction hash',
  [ValidationErrorCode.ASSET_CODE]: () => 'Invalid asset code',
  [ValidationErrorCode.CUSTOM]: (message) => message || 'Invalid value',
};

// Global message map that can be customized
let globalMessageMap: ErrorMessageMap = { ...defaultMessages };

/**
 * Set custom error messages
 */
export function setErrorMessages(messages: ErrorMessageMap): void {
  globalMessageMap = { ...defaultMessages, ...messages };
}

/**
 * Get error message for a validation code
 */
export function getErrorMessage(
  code: ValidationErrorCode | string,
  value?: any,
  params?: any,
  fieldName?: string,
): string {
  const message = globalMessageMap[code];
  if (typeof message === 'function') {
    return message(value, params);
  }
  return message || 'Invalid value';
}

/**
 * Create a validation result
 */
function createResult(
  valid: boolean,
  code?: ValidationErrorCode | string,
  message?: string,
  params?: any,
  fieldName?: string,
): ValidationResult {
  if (valid) {
    return { valid: true };
  }
  return {
    valid: false,
    code,
    message: message || getErrorMessage(code || ValidationErrorCode.CUSTOM, undefined, params, fieldName),
  };
}

// ============================================
// Built-in Validators
// ============================================

/**
 * Required field validator
 */
export const required = (message?: string): Validator => (value, _, fieldName) => {
  const isValid = value !== undefined && value !== null && value !== '';
  return createResult(
    isValid,
    ValidationErrorCode.REQUIRED,
    message,
    undefined,
    fieldName,
  );
};

/**
 * Email validator
 */
export const email = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return createResult(
    emailRegex.test(value),
    ValidationErrorCode.EMAIL,
    message,
    undefined,
    fieldName,
  );
};

/**
 * Minimum length validator
 */
export const minLength = (min: number, message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  return createResult(
    value.length >= min,
    ValidationErrorCode.MIN_LENGTH,
    message,
    min,
    fieldName,
  );
};

/**
 * Maximum length validator
 */
export const maxLength = (max: number, message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  return createResult(
    value.length <= max,
    ValidationErrorCode.MAX_LENGTH,
    message,
    max,
    fieldName,
  );
};

/**
 * Exact length validator
 */
export const exactLength = (length: number, message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  const isValid = value.length === length;
  return createResult(
    isValid,
    ValidationErrorCode.CUSTOM,
    message || `Must be exactly ${length} characters`,
    length,
    fieldName,
  );
};

/**
 * Minimum value validator (for numbers)
 */
export const min = (minimum: number, message?: string): Validator<number> => (value, _, fieldName) => {
  if (value === undefined || value === null) return { valid: true };
  const num = Number(value);
  return createResult(
    !isNaN(num) && num >= minimum,
    ValidationErrorCode.MIN_VALUE,
    message,
    minimum,
    fieldName,
  );
};

/**
 * Maximum value validator (for numbers)
 */
export const max = (maximum: number, message?: string): Validator<number> => (value, _, fieldName) => {
  if (value === undefined || value === null) return { valid: true };
  const num = Number(value);
  return createResult(
    !isNaN(num) && num <= maximum,
    ValidationErrorCode.MAX_VALUE,
    message,
    maximum,
    fieldName,
  );
};

/**
 * Number validator
 */
export const number = (message?: string): Validator => (value, _, fieldName) => {
  if (value === undefined || value === null || value === '') return { valid: true };
  return createResult(
    !isNaN(Number(value)) && typeof Number(value) === 'number',
    ValidationErrorCode.NUMBER,
    message,
    undefined,
    fieldName,
  );
};

/**
 * Integer validator
 */
export const integer = (message?: string): Validator => (value, _, fieldName) => {
  if (value === undefined || value === null || value === '') return { valid: true };
  const num = Number(value);
  return createResult(
    !isNaN(num) && Number.isInteger(num),
    ValidationErrorCode.NUMBER,
    message || 'Must be a whole number',
    undefined,
    fieldName,
  );
};

/**
 * Positive number validator
 */
export const positive = (message?: string): Validator<number> => (value, _, fieldName) => {
  if (value === undefined || value === null) return { valid: true };
  const num = Number(value);
  return createResult(
    !isNaN(num) && num > 0,
    ValidationErrorCode.CUSTOM,
    message || 'Must be a positive number',
    undefined,
    fieldName,
  );
};

/**
 * Non-negative number validator (zero or positive)
 */
export const nonNegative = (message?: string): Validator<number> => (value, _, fieldName) => {
  if (value === undefined || value === null) return { valid: true };
  const num = Number(value);
  return createResult(
    !isNaN(num) && num >= 0,
    ValidationErrorCode.CUSTOM,
    message || 'Must be zero or a positive number',
    undefined,
    fieldName,
  );
};

/**
 * URL validator
 */
export const url = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  try {
    new URL(value);
    return { valid: true };
  } catch {
    return createResult(
      false,
      ValidationErrorCode.URL,
      message,
      undefined,
      fieldName,
    );
  }
};

/**
 * Pattern validator (regex)
 */
export const pattern = (regex: RegExp, message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  return createResult(
    regex.test(value),
    ValidationErrorCode.PATTERN,
    message,
    undefined,
    fieldName,
  );
};

/**
 * Match another field validator
 */
export const match = (fieldToMatch: string, message?: string): Validator => (value, formData, fieldName) => {
  if (!formData) return { valid: true };
  const otherValue = formData[fieldToMatch];
  return createResult(
    value === otherValue,
    ValidationErrorCode.CUSTOM,
    message || `Must match ${fieldToMatch}`,
    undefined,
    fieldName,
  );
};

/**
 * One of validator (enum-like)
 */
export const oneOf = <T>(allowedValues: T[], message?: string): Validator<T> => (value, _, fieldName) => {
  if (value === undefined || value === null) return { valid: true };
  return createResult(
    allowedValues.includes(value),
    ValidationErrorCode.CUSTOM,
    message || `Must be one of: ${allowedValues.join(', ')}`,
    undefined,
    fieldName,
  );
};

/**
 * Custom validator creator
 */
export const custom = <T>(
  validateFn: (value: T) => boolean,
  message?: string,
  code?: string,
): Validator<T> => (value, _, fieldName) => {
  if (value === undefined || value === null) return { valid: true };
  return createResult(
    validateFn(value),
    code || ValidationErrorCode.CUSTOM,
    message,
    undefined,
    fieldName,
  );
};

// ============================================
// Validator Composition
// ============================================

/**
 * Compose multiple validators into one (all must pass)
 */
export const compose = <T>(...validators: Validator<T>[]): Validator<T> => {
  return async (value, formData, fieldName) => {
    for (const validator of validators) {
      const result = await validator(value, formData, fieldName);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  };
};

/**
 * Compose validators with OR logic (at least one must pass)
 */
export const any = <T>(...validators: Validator<T>[]): Validator<T> => {
  return async (value, formData, fieldName) => {
    const errors: ValidationResult[] = [];
    
    for (const validator of validators) {
      const result = await validator(value, formData, fieldName);
      if (result.valid) {
        return { valid: true };
      }
      errors.push(result);
    }
    
    return errors[0] || { valid: false, message: 'Validation failed' };
  };
};

/**
 * Optional validator - only validates if value is present
 */
export const optional = <T>(validator: Validator<T>): Validator<T> => {
  return (value, formData, fieldName) => {
    if (value === undefined || value === null || value === '') {
      return { valid: true };
    }
    return validator(value, formData, fieldName);
  };
};

/**
 * Conditional validator - only validates if condition is met
 */
export const when = <T>(
  condition: (formData: Record<string, any>) => boolean,
  validator: Validator<T>,
): Validator<T> => {
  return (value, formData, fieldName) => {
    if (!formData || !condition(formData)) {
      return { valid: true };
    }
    return validator(value, formData, fieldName);
  };
};

// ============================================
// Array Validators
// ============================================

/**
 * Array min length validator
 */
export const arrayMinLength = (min: number, message?: string): Validator<any[]> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  return createResult(
    Array.isArray(value) && value.length >= min,
    ValidationErrorCode.CUSTOM,
    message || `Must have at least ${min} items`,
    min,
    fieldName,
  );
};

/**
 * Array max length validator
 */
export const arrayMaxLength = (max: number, message?: string): Validator<any[]> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  return createResult(
    Array.isArray(value) && value.length <= max,
    ValidationErrorCode.CUSTOM,
    message || `Must have no more than ${max} items`,
    max,
    fieldName,
  );
};

/**
 * Validate each item in an array
 */
export const each = <T>(validator: Validator<T>): Validator<T[]> => {
  return async (value, formData, fieldName) => {
    if (!Array.isArray(value) || value.length === 0) {
      return { valid: true };
    }
    
    for (let i = 0; i < value.length; i++) {
      const result = await validator(value[i], formData, `${fieldName}[${i}]`);
      if (!result.valid) {
        return {
          valid: false,
          code: result.code,
          message: `Item ${i + 1}: ${result.message}`,
        };
      }
    }
    
    return { valid: true };
  };
};
