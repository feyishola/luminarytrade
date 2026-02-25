// Validation Framework - Main Export

// Types
export type {
  ValidationResult,
  ValidationErrors,
  Validator,
  ValidationSchema,
  ValidationOptions,
  FormValidationState,
  AsyncValidationResult,
  ValidationRule,
  ErrorMessageMap,
  ValidatorComposer,
  FieldValidatorConfig,
} from './types';

// Core Validators
export {
  required,
  email,
  minLength,
  maxLength,
  exactLength,
  min,
  max,
  number,
  integer,
  positive,
  nonNegative,
  url,
  pattern,
  match,
  oneOf,
  custom,
  compose,
  any,
  optional,
  when,
  arrayMinLength,
  arrayMaxLength,
  each,
  setErrorMessages,
  getErrorMessage,
} from './validators';

// Blockchain Validators
export {
  stellarAddress,
  stellarPublicKey,
  stellarSecretKey,
  transactionHash,
  assetCode,
  amount,
  memo,
  contractAddress,
  hexString,
  signature,
  networkId,
} from './blockchain-validators';

// Async Validators
export {
  uniqueEmail,
  existingStellarAddress,
  validAssetCode,
  rateLimited,
  debounced,
  conditionalAsync,
  CachedAsyncValidator,
  cachedAsync,
} from './async-validators';

// Validation Service
export {
  ValidationService,
  createFormValidator,
} from './validation-service';

// Helper Functions
export {
  createResult,
  flattenErrors,
  hasErrors,
} from './helpers';

// Re-export for convenience
export { ValidationErrorCode } from './types';
export { ValidationErrorCode as ErrorCode } from './types';
