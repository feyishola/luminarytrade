import { Validator, ValidationErrorCode } from './types';
import { createResult } from './helpers';

/**
 * Stellar address validator
 * Validates both public keys (G...) and secret keys (S...)
 */
export const stellarAddress = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  // Stellar addresses are 56 characters long and start with G or S
  const stellarRegex = /^(G|S)[A-Z2-7]{55}$/;
  
  return createResult(
    stellarRegex.test(value),
    ValidationErrorCode.STELLAR_ADDRESS,
    message,
    undefined,
    fieldName,
  );
};

/**
 * Stellar public key validator
 * Validates only public keys (G...)
 */
export const stellarPublicKey = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  // Stellar public keys are 56 characters long and start with G
  const publicKeyRegex = /^G[A-Z2-7]{55}$/;
  
  return createResult(
    publicKeyRegex.test(value),
    ValidationErrorCode.STELLAR_ADDRESS,
    message,
    undefined,
    fieldName,
  );
};

/**
 * Stellar secret key validator
 * Validates only secret keys (S...)
 */
export const stellarSecretKey = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  // Stellar secret keys are 56 characters long and start with S
  const secretKeyRegex = /^S[A-Z2-7]{55}$/;
  
  return createResult(
    secretKeyRegex.test(value),
    ValidationErrorCode.CUSTOM,
    message || 'Invalid Stellar secret key',
    undefined,
    fieldName,
  );
};

/**
 * Transaction hash validator
 * Validates hex string format (typically 64 characters)
 */
export const transactionHash = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  // Transaction hashes are typically 64 hex characters
  const hashRegex = /^[a-fA-F0-9]{64}$/;
  
  return createResult(
    hashRegex.test(value),
    ValidationErrorCode.TRANSACTION_HASH,
    message,
    undefined,
    fieldName,
  );
};

/**
 * Asset code validator
 * Validates Stellar asset codes (3-12 alphanumeric characters)
 */
export const assetCode = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  // Stellar asset codes: 3-12 alphanumeric characters
  const codeRegex = /^[A-Za-z0-9]{3,12}$/;
  
  return createResult(
    codeRegex.test(value),
    ValidationErrorCode.ASSET_CODE,
    message,
    undefined,
    fieldName,
  );
};

/**
 * Amount validator
 * Validates positive decimal amounts
 */
export const amount = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  const num = parseFloat(value);
  const isValidNumber = !isNaN(num) && isFinite(num) && num >= 0;
  
  return createResult(
    isValidNumber,
    ValidationErrorCode.CUSTOM,
    message || 'Must be a valid positive amount',
    undefined,
    fieldName,
  );
};

/**
 * Memo validator
 * Validates Stellar memo fields (text, id, or hash)
 */
export const memo = (maxLength: number = 28, message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  const isValid = typeof value === 'string' && value.length <= maxLength;
  
  return createResult(
    isValid,
    ValidationErrorCode.CUSTOM,
    message || `Memo must be no more than ${maxLength} characters`,
    maxLength,
    fieldName,
  );
};

/**
 * Contract address validator (generic for EVM-compatible chains)
 */
export const contractAddress = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  // Ethereum-style address (42 characters: 0x + 40 hex chars)
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  
  return createResult(
    addressRegex.test(value),
    ValidationErrorCode.CUSTOM,
    message || 'Invalid contract address',
    undefined,
    fieldName,
  );
};

/**
 * Hex string validator
 * Validates hexadecimal string format
 */
export const hexString = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  const hexRegex = /^0x[a-fA-F0-9]+$/;
  const plainHexRegex = /^[a-fA-F0-9]+$/;
  
  const isValid = hexRegex.test(value) || plainHexRegex.test(value);
  
  return createResult(
    isValid,
    ValidationErrorCode.CUSTOM,
    message || 'Invalid hex string',
    undefined,
    fieldName,
  );
};

/**
 * Signature validator
 * Validates cryptographic signature format
 */
export const signature = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  // Basic signature validation: hex string of reasonable length
  const sigRegex = /^[a-fA-F0-9]{128}$/; // Typical ECDSA signature length
  
  return createResult(
    sigRegex.test(value),
    ValidationErrorCode.CUSTOM,
    message || 'Invalid signature format',
    undefined,
    fieldName,
  );
};

/**
 * Network identifier validator
 * Validates network identifiers (e.g., "mainnet", "testnet", etc.)
 */
export const networkId = (message?: string): Validator<string> => (value, _, fieldName) => {
  if (!value) return { valid: true };
  
  // Allow common network identifiers
  const validNetworks = ['mainnet', 'testnet', 'futurenet', 'sandbox', 'local'];
  const isValid = validNetworks.includes(value.toLowerCase());
  
  return createResult(
    isValid,
    ValidationErrorCode.CUSTOM,
    message || 'Invalid network identifier',
    undefined,
    fieldName,
  );
};
