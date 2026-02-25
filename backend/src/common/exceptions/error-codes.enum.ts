export enum ERROR_CODES {
  // Auth
  INVALID_SIGNATURE = 'AUTH_001',
  TOKEN_EXPIRED = 'AUTH_002',

  // Validation
  INVALID_INPUT = 'VAL_001',

  // Business
  INSUFFICIENT_BALANCE = 'BUS_001',

  // Integration
  ORACLE_TIMEOUT = 'INT_001',
  THIRD_PARTY_FAILURE = 'INT_002',

  // Audit
  AUDIT_WRITE_FAILED = 'AUD_001',

  // Generic
  INTERNAL_ERROR = 'GEN_001',
}