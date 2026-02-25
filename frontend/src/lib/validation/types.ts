/**
 * Validation result for a single field
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
  code?: string;
}

/**
 * Validation errors for an entire form
 */
export type ValidationErrors<T = Record<string, any>> = {
  [K in keyof T]?: ValidationResult;
};

/**
 * Validator function type - can be sync or async
 */
export type Validator<T = any> = (
  value: T,
  formData?: Record<string, any>,
  fieldName?: string,
) => ValidationResult | Promise<ValidationResult>;

/**
 * Field validation configuration
 */
export interface FieldValidation<T = any> {
  field: keyof T;
  validators: Validator<T[keyof T]>[];
  required?: boolean;
  conditional?: (formData: T) => boolean;
  asyncValidators?: Validator<T[keyof T]>[];
}

/**
 * Form validation schema
 */
export type ValidationSchema<T = Record<string, any>> = {
  [K in keyof T]?: FieldValidation<T>;
};

/**
 * Validation options
 */
export interface ValidationOptions {
  stopOnFirstError?: boolean;
  validateAllFields?: boolean;
  abortEarly?: boolean;
}

/**
 * Form validation state
 */
export interface FormValidationState<T = Record<string, any>> {
  errors: ValidationErrors<T>;
  isValid: boolean;
  isValidating: boolean;
  touched: { [K in keyof T]?: boolean };
  dirty: { [K in keyof T]?: boolean };
}

/**
 * Async validation result
 */
export interface AsyncValidationResult extends ValidationResult {
  pending?: boolean;
}

/**
 * Validation rule configuration
 */
export interface ValidationRule<T = any> {
  name: string;
  validator: Validator<T>;
  message?: string | ((value: T, fieldName?: string) => string);
}

/**
 * Built-in validation error codes
 */
export enum ValidationErrorCode {
  REQUIRED = 'REQUIRED',
  EMAIL = 'EMAIL',
  MIN_LENGTH = 'MIN_LENGTH',
  MAX_LENGTH = 'MAX_LENGTH',
  MIN_VALUE = 'MIN_VALUE',
  MAX_VALUE = 'MAX_VALUE',
  NUMBER = 'NUMBER',
  URL = 'URL',
  PATTERN = 'PATTERN',
  STELLAR_ADDRESS = 'STELLAR_ADDRESS',
  TRANSACTION_HASH = 'TRANSACTION_HASH',
  ASSET_CODE = 'ASSET_CODE',
  CUSTOM = 'CUSTOM',
}

/**
 * Error message map
 */
export type ErrorMessageMap = {
  [key in ValidationErrorCode | string]?: string | ((value: any, params?: any) => string);
};

/**
 * Validator composition function
 */
export type ValidatorComposer<T = any> = (...validators: Validator<T>[]) => Validator<T>;

/**
 * Field validator configuration object
 */
export interface FieldValidatorConfig<T = any> {
  required?: boolean | string;
  email?: boolean | string;
  minLength?: number | { value: number; message: string };
  maxLength?: number | { value: number; message: string };
  min?: number | { value: number; message: string };
  max?: number | { value: number; message: string };
  pattern?: RegExp | { value: RegExp; message: string };
  url?: boolean | string;
  number?: boolean | string;
  stellarAddress?: boolean | string;
  transactionHash?: boolean | string;
  custom?: Validator<T> | Validator<T>[];
  async?: Validator<T> | Validator<T>[];
  validate?: (value: T, formData: Record<string, any>) => ValidationResult | Promise<ValidationResult>;
}
