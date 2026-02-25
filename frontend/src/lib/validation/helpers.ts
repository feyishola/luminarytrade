import { ValidationResult, ValidationErrorCode } from './types';

/**
 * Create a validation result
 */
export function createResult(
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
    message: message || getDefaultErrorMessage(code || ValidationErrorCode.CUSTOM, params, fieldName),
  };
}

/**
 * Get default error message for a validation code
 */
function getDefaultErrorMessage(
  code: ValidationErrorCode | string,
  params?: any,
  fieldName?: string,
): string {
  switch (code) {
    case ValidationErrorCode.REQUIRED:
      return `${fieldName || 'This field'} is required`;
    case ValidationErrorCode.EMAIL:
      return 'Please enter a valid email address';
    case ValidationErrorCode.MIN_LENGTH:
      return `Must be at least ${params} characters`;
    case ValidationErrorCode.MAX_LENGTH:
      return `Must be no more than ${params} characters`;
    case ValidationErrorCode.MIN_VALUE:
      return `Must be at least ${params}`;
    case ValidationErrorCode.MAX_VALUE:
      return `Must be no more than ${params}`;
    case ValidationErrorCode.NUMBER:
      return 'Must be a valid number';
    case ValidationErrorCode.URL:
      return 'Please enter a valid URL';
    case ValidationErrorCode.PATTERN:
      return 'Invalid format';
    case ValidationErrorCode.STELLAR_ADDRESS:
      return 'Invalid Stellar address';
    case ValidationErrorCode.TRANSACTION_HASH:
      return 'Invalid transaction hash';
    case ValidationErrorCode.ASSET_CODE:
      return 'Invalid asset code';
    default:
      return 'Invalid value';
  }
}

/**
 * Flatten validation errors into a simple object
 */
export function flattenErrors(errors: Record<string, any>): Record<string, string> {
  const flattened: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(errors)) {
    if (value && typeof value === 'object' && 'message' in value) {
      flattened[key] = (value as any).message;
    } else if (Array.isArray(value)) {
      flattened[key] = value.map(item => 
        typeof item === 'object' && item.message ? item.message : String(item)
      ).join(', ');
    } else {
      flattened[key] = String(value);
    }
  }
  
  return flattened;
}

/**
 * Check if an object has any validation errors
 */
export function hasErrors(errors: Record<string, any>): boolean {
  return Object.values(errors).some(error => 
    error && typeof error === 'object' && !error.valid
  );
}