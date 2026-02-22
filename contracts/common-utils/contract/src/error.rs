//! # Contract Error Module
//!
//! Provides standardized error handling for Soroban smart contracts.
//!
//! ## Error Code Registry
//!
//! - 1000-1099: Validation Errors
//! - 1100-1199: Authorization Errors
//! - 1200-1299: Storage Errors
//! - 1300-1399: Cryptographic Errors
//! - 1400-1499: Contract State Errors
//! - 1500-1599: External Errors
//! - 9999: Unknown Error

use soroban_sdk::{contracterror, symbol_short, Bytes, Env, Symbol};

/// Core trait for all contract errors
pub trait ContractError: core::fmt::Debug + Copy + Clone {
    /// Get the error code
    fn code(&self) -> u32;

    /// Get the error message
    fn message(&self) -> &'static str;

    /// Get error category
    fn category(&self) -> ErrorCategory;

    /// Check if this error is recoverable
    fn is_recoverable(&self) -> bool;

    /// Convert to Result<T, ContractError>
    fn into_result<T>(self) -> Result<T, Self> {
        Err(self)
    }
}

/// Error categories for grouping related errors
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ErrorCategory {
    Validation,
    Authorization,
    Storage,
    Cryptographic,
    State,
    External,
    Unknown,
}

/// Standardized validation errors (1000-1099)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ValidationError {
    /// Invalid input format
    InvalidFormat = 1001,
    /// Missing required field
    MissingRequiredField = 1002,
    /// Value out of range
    OutOfRange = 1003,
    /// Invalid length
    InvalidLength = 1004,
    /// Invalid format for CID
    InvalidCidFormat = 1005,
    /// Invalid hash format
    InvalidHashFormat = 1006,
    /// Invalid JSON structure
    InvalidJsonStructure = 1007,
    /// Invalid address format
    InvalidAddress = 1008,
    /// Invalid timestamp
    InvalidTimestamp = 1009,
    /// Invalid signature format
    InvalidSignatureFormat = 1010,
}

impl ContractError for ValidationError {
    fn code(&self) -> u32 {
        *self as u32
    }

    fn message(&self) -> &'static str {
        match self {
            ValidationError::InvalidFormat => "Invalid input format",
            ValidationError::MissingRequiredField => "Missing required field",
            ValidationError::OutOfRange => "Value out of allowed range",
            ValidationError::InvalidLength => "Invalid data length",
            ValidationError::InvalidCidFormat => "Invalid CID format",
            ValidationError::InvalidHashFormat => "Invalid hash format",
            ValidationError::InvalidJsonStructure => "Invalid JSON structure",
            ValidationError::InvalidAddress => "Invalid address format",
            ValidationError::InvalidTimestamp => "Invalid or expired timestamp",
            ValidationError::InvalidSignatureFormat => "Invalid signature format",
        }
    }

    fn category(&self) -> ErrorCategory {
        ErrorCategory::Validation
    }

    fn is_recoverable(&self) -> bool {
        true
    }
}

/// Authorization errors (1100-1199)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AuthorizationError {
    /// Not authorized
    NotAuthorized = 1101,
    /// Invalid authentication
    InvalidAuthentication = 1102,
    /// Insufficient permissions
    InsufficientPermissions = 1103,
    /// Not an approved reporter
    NotApprovedReporter = 1104,
    /// Admin only operation
    AdminOnly = 1105,
    /// Authorization expired
    AuthorizationExpired = 1106,
    /// Invalid credentials
    InvalidCredentials = 1107,
    /// Account disabled
    AccountDisabled = 1108,
    /// Not initialized
    NotInitialized = 1109,
    /// Already initialized
    AlreadyInitialized = 1110,
}

impl ContractError for AuthorizationError {
    fn code(&self) -> u32 {
        *self as u32
    }

    fn message(&self) -> &'static str {
        match self {
            AuthorizationError::NotAuthorized => "Not authorized to perform this action",
            AuthorizationError::InvalidAuthentication => "Invalid authentication",
            AuthorizationError::InsufficientPermissions => "Insufficient permissions",
            AuthorizationError::NotApprovedReporter => "Not an approved reporter",
            AuthorizationError::AdminOnly => "Admin only operation",
            AuthorizationError::AuthorizationExpired => "Authorization expired",
            AuthorizationError::InvalidCredentials => "Invalid credentials",
            AuthorizationError::AccountDisabled => "Account is disabled",
            AuthorizationError::NotInitialized => "Contract not initialized",
            AuthorizationError::AlreadyInitialized => "Contract already initialized",
        }
    }

    fn category(&self) -> ErrorCategory {
        ErrorCategory::Authorization
    }

    fn is_recoverable(&self) -> bool {
        matches!(self, AuthorizationError::AuthorizationExpired)
    }
}

/// Storage errors (1200-1299)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StorageError {
    /// Key not found
    KeyNotFound = 1201,
    /// Storage full
    StorageFull = 1202,
    /// Data corruption detected
    DataCorruption = 1203,
    /// Invalid storage key
    InvalidStorageKey = 1204,
    /// Storage quota exceeded
    QuotaExceeded = 1205,
    /// Concurrent modification
    ConcurrentModification = 1206,
    /// Invalid data format
    InvalidDataFormat = 1207,
    /// Expired data
    ExpiredData = 1208,
    /// Migration failed
    MigrationFailed = 1209,
    /// Backup failed
    BackupFailed = 1210,
}

impl ContractError for StorageError {
    fn code(&self) -> u32 {
        *self as u32
    }

    fn message(&self) -> &'static str {
        match self {
            StorageError::KeyNotFound => "Storage key not found",
            StorageError::StorageFull => "Storage is full",
            StorageError::DataCorruption => "Data corruption detected",
            StorageError::InvalidStorageKey => "Invalid storage key",
            StorageError::QuotaExceeded => "Storage quota exceeded",
            StorageError::ConcurrentModification => "Concurrent modification detected",
            StorageError::InvalidDataFormat => "Invalid data format in storage",
            StorageError::ExpiredData => "Data has expired",
            StorageError::MigrationFailed => "Data migration failed",
            StorageError::BackupFailed => "Backup operation failed",
        }
    }

    fn category(&self) -> ErrorCategory {
        ErrorCategory::Storage
    }

    fn is_recoverable(&self) -> bool {
        matches!(
            self,
            StorageError::ConcurrentModification | StorageError::ExpiredData
        )
    }
}

/// Cryptographic errors (1300-1399)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CryptoError {
    /// Invalid signature
    InvalidSignature = 1301,
    /// Signature verification failed
    SignatureVerificationFailed = 1302,
    /// Invalid public key
    InvalidPublicKey = 1303,
    /// Invalid private key
    InvalidPrivateKey = 1304,
    /// Hash mismatch
    HashMismatch = 1305,
    /// Invalid hash algorithm
    InvalidHashAlgorithm = 1306,
    /// Encryption failed
    EncryptionFailed = 1307,
    /// Decryption failed
    DecryptionFailed = 1308,
    /// Invalid nonce
    InvalidNonce = 1309,
    /// Key derivation failed
    KeyDerivationFailed = 1310,
}

impl ContractError for CryptoError {
    fn code(&self) -> u32 {
        *self as u32
    }

    fn message(&self) -> &'static str {
        match self {
            CryptoError::InvalidSignature => "Invalid signature",
            CryptoError::SignatureVerificationFailed => "Signature verification failed",
            CryptoError::InvalidPublicKey => "Invalid public key",
            CryptoError::InvalidPrivateKey => "Invalid private key",
            CryptoError::HashMismatch => "Hash mismatch",
            CryptoError::InvalidHashAlgorithm => "Invalid hash algorithm",
            CryptoError::EncryptionFailed => "Encryption failed",
            CryptoError::DecryptionFailed => "Decryption failed",
            CryptoError::InvalidNonce => "Invalid nonce",
            CryptoError::KeyDerivationFailed => "Key derivation failed",
        }
    }

    fn category(&self) -> ErrorCategory {
        ErrorCategory::Cryptographic
    }

    fn is_recoverable(&self) -> bool {
        false
    }
}

/// Contract state errors (1400-1499)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StateError {
    /// Invalid state transition
    InvalidStateTransition = 1401,
    /// Contract paused
    ContractPaused = 1402,
    /// Contract frozen
    ContractFrozen = 1403,
    /// Upgrade required
    UpgradeRequired = 1404,
    /// Deprecated function
    DeprecatedFunction = 1405,
    /// Invalid configuration
    InvalidConfiguration = 1406,
    /// Rate limit exceeded
    RateLimitExceeded = 1407,
    /// Circuit breaker open
    CircuitBreakerOpen = 1408,
    /// Maintenance mode
    MaintenanceMode = 1409,
    /// Invalid version
    InvalidVersion = 1410,
}

impl ContractError for StateError {
    fn code(&self) -> u32 {
        *self as u32
    }

    fn message(&self) -> &'static str {
        match self {
            StateError::InvalidStateTransition => "Invalid state transition",
            StateError::ContractPaused => "Contract is paused",
            StateError::ContractFrozen => "Contract is frozen",
            StateError::UpgradeRequired => "Upgrade required",
            StateError::DeprecatedFunction => "Function is deprecated",
            StateError::InvalidConfiguration => "Invalid configuration",
            StateError::RateLimitExceeded => "Rate limit exceeded",
            StateError::CircuitBreakerOpen => "Circuit breaker is open",
            StateError::MaintenanceMode => "Contract in maintenance mode",
            StateError::InvalidVersion => "Invalid version",
        }
    }

    fn category(&self) -> ErrorCategory {
        ErrorCategory::State
    }

    fn is_recoverable(&self) -> bool {
        matches!(
            self,
            StateError::ContractPaused
                | StateError::MaintenanceMode
                | StateError::RateLimitExceeded
        )
    }
}

/// External errors (1500-1599)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ExternalError {
    /// Oracle unavailable
    OracleUnavailable = 1501,
    /// Network error
    NetworkError = 1502,
    /// Timeout
    Timeout = 1503,
    /// External service error
    ExternalServiceError = 1504,
    /// Invalid external data
    InvalidExternalData = 1505,
    /// Bridge unavailable
    BridgeUnavailable = 1506,
    /// AI service error
    AIServiceError = 1507,
    /// Insufficient funds
    InsufficientFunds = 1508,
    /// Transaction failed
    TransactionFailed = 1509,
    /// Callback failed
    CallbackFailed = 1510,
}

impl ContractError for ExternalError {
    fn code(&self) -> u32 {
        *self as u32
    }

    fn message(&self) -> &'static str {
        match self {
            ExternalError::OracleUnavailable => "Oracle service unavailable",
            ExternalError::NetworkError => "Network error occurred",
            ExternalError::Timeout => "Operation timed out",
            ExternalError::ExternalServiceError => "External service error",
            ExternalError::InvalidExternalData => "Invalid external data",
            ExternalError::BridgeUnavailable => "Bridge service unavailable",
            ExternalError::AIServiceError => "AI service error",
            ExternalError::InsufficientFunds => "Insufficient funds",
            ExternalError::TransactionFailed => "Transaction failed",
            ExternalError::CallbackFailed => "Callback failed",
        }
    }

    fn category(&self) -> ErrorCategory {
        ErrorCategory::External
    }

    fn is_recoverable(&self) -> bool {
        matches!(
            self,
            ExternalError::OracleUnavailable
                | ExternalError::NetworkError
                | ExternalError::Timeout
                | ExternalError::BridgeUnavailable
                | ExternalError::AIServiceError
        )
    }
}

/// Unknown error (9999)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum UnknownError {
    /// Unknown error occurred
    Unknown = 9999,
}

impl ContractError for UnknownError {
    fn code(&self) -> u32 {
        9999
    }

    fn message(&self) -> &'static str {
        "Unknown error occurred"
    }

    fn category(&self) -> ErrorCategory {
        ErrorCategory::Unknown
    }

    fn is_recoverable(&self) -> bool {
        false
    }
}

/// Unified error type that wraps all error types
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractErrorType {
    Validation(ValidationError) = 1000,
    Authorization(AuthorizationError) = 1100,
    Storage(StorageError) = 1200,
    Cryptographic(CryptoError) = 1300,
    State(StateError) = 1400,
    External(ExternalError) = 1500,
    Unknown(UnknownError) = 9999,
}

/// Error context for providing additional information
#[derive(Clone, Debug)]
pub struct ErrorContext {
    pub operation: Symbol,
    pub field: Option<Symbol>,
    pub expected: Option<Bytes>,
    pub actual: Option<Bytes>,
    pub suggestion: Option<Symbol>,
}

impl ErrorContext {
    pub fn new(operation: &str) -> Self {
        Self {
            operation: Symbol::new(&Env::default(), operation),
            field: None,
            expected: None,
            actual: None,
            suggestion: None,
        }
    }

    pub fn with_field(mut self, field: &str) -> Self {
        self.field = Some(Symbol::new(&Env::default(), field));
        self
    }

    pub fn with_expected(mut self, expected: Bytes) -> Self {
        self.expected = Some(expected);
        self
    }

    pub fn with_actual(mut self, actual: Bytes) -> Self {
        self.actual = Some(actual);
        self
    }

    pub fn with_suggestion(mut self, suggestion: &str) -> Self {
        self.suggestion = Some(Symbol::new(&Env::default(), suggestion));
        self
    }
}

/// Helper functions for error handling
pub mod helpers {
    use super::*;

    /// Ensure a condition is met, returning an error if not
    pub fn ensure<T, E>(condition: bool, error: E) -> Result<(), E> {
        if condition {
            Ok(())
        } else {
            Err(error)
        }
    }

    /// Ensure a condition is met with a custom error message
    pub fn ensure_with_context<T, E, F>(
        condition: bool,
        error_fn: F,
    ) -> Result<(), E>
    where
        F: FnOnce() -> E,
    {
        if condition {
            Ok(())
        } else {
            Err(error_fn())
        }
    }

    /// Convert Option to Result with a specific error
    pub fn ok_or<E, T>(option: Option<T>, error: E) -> Result<T, E> {
        match option {
            Some(value) => Ok(value),
            None => Err(error),
        }
    }

    /// Map error to ContractErrorType
    pub fn map_to_contract_error<E: ContractError>(error: E) -> ContractErrorType {
        match error.category() {
            ErrorCategory::Validation => {
                ContractErrorType::Validation(unsafe { core::mem::transmute(error.code()) })
            }
            ErrorCategory::Authorization => {
                ContractErrorType::Authorization(unsafe { core::mem::transmute(error.code()) })
            }
            ErrorCategory::Storage => {
                ContractErrorType::Storage(unsafe { core::mem::transmute(error.code()) })
            }
            ErrorCategory::Cryptographic => {
                ContractErrorType::Cryptographic(unsafe { core::mem::transmute(error.code()) })
            }
            ErrorCategory::State => {
                ContractErrorType::State(unsafe { core::mem::transmute(error.code()) })
            }
            ErrorCategory::External => {
                ContractErrorType::External(unsafe { core::mem::transmute(error.code()) })
            }
            ErrorCategory::Unknown => ContractErrorType::Unknown(UnknownError::Unknown),
        }
    }
}

/// Error code registry for documentation
pub mod registry {
    use super::*;

    /// Get all validation error codes
    pub const VALIDATION_ERROR_CODES: &[u32] = &[
        1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010,
    ];

    /// Get all authorization error codes
    pub const AUTHORIZATION_ERROR_CODES: &[u32] = &[
        1101, 1102, 1103, 1104, 1105, 1106, 1107, 1108, 1109, 1110,
    ];

    /// Get all storage error codes
    pub const STORAGE_ERROR_CODES: &[u32] = &[
        1201, 1202, 1203, 1204, 1205, 1206, 1207, 1208, 1209, 1210,
    ];

    /// Get all cryptographic error codes
    pub const CRYPTO_ERROR_CODES: &[u32] = &[
        1301, 1302, 1303, 1304, 1305, 1306, 1307, 1308, 1309, 1310,
    ];

    /// Get all state error codes
    pub const STATE_ERROR_CODES: &[u32] = &[
        1401, 1402, 1403, 1404, 1405, 1406, 1407, 1408, 1409, 1410,
    ];

    /// Get all external error codes
    pub const EXTERNAL_ERROR_CODES: &[u32] = &[
        1501, 1502, 1503, 1504, 1505, 1506, 1507, 1508, 1509, 1510,
    ];

    /// Get error category for a code
    pub fn get_category(code: u32) -> ErrorCategory {
        match code {
            1000..=1099 => ErrorCategory::Validation,
            1100..=1199 => ErrorCategory::Authorization,
            1200..=1299 => ErrorCategory::Storage,
            1300..=1399 => ErrorCategory::Cryptographic,
            1400..=1499 => ErrorCategory::State,
            1500..=1599 => ErrorCategory::External,
            _ => ErrorCategory::Unknown,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_error_codes() {
        assert_eq!(ValidationError::InvalidFormat.code(), 1001);
        assert_eq!(ValidationError::MissingRequiredField.code(), 1002);
        assert_eq!(ValidationError::InvalidCidFormat.code(), 1005);
    }

    #[test]
    fn test_authorization_error_codes() {
        assert_eq!(AuthorizationError::NotAuthorized.code(), 1101);
        assert_eq!(AuthorizationError::AlreadyInitialized.code(), 1110);
    }

    #[test]
    fn test_error_categories() {
        assert_eq!(
            ValidationError::InvalidFormat.category(),
            ErrorCategory::Validation
        );
        assert_eq!(
            AuthorizationError::NotAuthorized.category(),
            ErrorCategory::Authorization
        );
        assert_eq!(
            StorageError::KeyNotFound.category(),
            ErrorCategory::Storage
        );
    }

    #[test]
    fn test_error_messages() {
        assert_eq!(
            ValidationError::InvalidFormat.message(),
            "Invalid input format"
        );
        assert_eq!(
            AuthorizationError::NotAuthorized.message(),
            "Not authorized to perform this action"
        );
    }

    #[test]
    fn test_recoverable_errors() {
        assert!(ValidationError::InvalidFormat.is_recoverable());
        assert!(!CryptoError::InvalidSignature.is_recoverable());
        assert!(AuthorizationError::AuthorizationExpired.is_recoverable());
    }

    #[test]
    fn test_registry() {
        assert_eq!(registry::get_category(1001), ErrorCategory::Validation);
        assert_eq!(registry::get_category(1101), ErrorCategory::Authorization);
        assert_eq!(registry::get_category(9999), ErrorCategory::Unknown);
    }
}

#[cfg(test)]
mod comprehensive_tests {
    use super::*;

    #[test]
    fn test_all_validation_errors() {
        let errors = vec![
            ValidationError::InvalidFormat,
            ValidationError::MissingRequiredField,
            ValidationError::OutOfRange,
            ValidationError::InvalidLength,
            ValidationError::InvalidCidFormat,
            ValidationError::InvalidHashFormat,
            ValidationError::InvalidJsonStructure,
            ValidationError::InvalidAddress,
            ValidationError::InvalidTimestamp,
            ValidationError::InvalidSignatureFormat,
        ];

        for (i, error) in errors.iter().enumerate() {
            assert_eq!(error.code(), 1001 + i as u32);
            assert_eq!(error.category(), ErrorCategory::Validation);
            assert!(error.is_recoverable());
            assert!(!error.message().is_empty());
        }
    }

    #[test]
    fn test_all_authorization_errors() {
        let errors = vec![
            AuthorizationError::NotAuthorized,
            AuthorizationError::InvalidAuthentication,
            AuthorizationError::InsufficientPermissions,
            AuthorizationError::NotApprovedReporter,
            AuthorizationError::AdminOnly,
            AuthorizationError::AuthorizationExpired,
            AuthorizationError::InvalidCredentials,
            AuthorizationError::AccountDisabled,
            AuthorizationError::NotInitialized,
            AuthorizationError::AlreadyInitialized,
        ];

        for (i, error) in errors.iter().enumerate() {
            assert_eq!(error.code(), 1101 + i as u32);
            assert_eq!(error.category(), ErrorCategory::Authorization);
            assert!(!error.message().is_empty());
        }
    }

    #[test]
    fn test_all_storage_errors() {
        let errors = vec![
            StorageError::KeyNotFound,
            StorageError::StorageFull,
            StorageError::DataCorruption,
            StorageError::InvalidStorageKey,
            StorageError::QuotaExceeded,
            StorageError::ConcurrentModification,
            StorageError::InvalidDataFormat,
            StorageError::ExpiredData,
            StorageError::MigrationFailed,
            StorageError::BackupFailed,
        ];

        for (i, error) in errors.iter().enumerate() {
            assert_eq!(error.code(), 1201 + i as u32);
            assert_eq!(error.category(), ErrorCategory::Storage);
            assert!(!error.message().is_empty());
        }
    }

    #[test]
    fn test_all_crypto_errors() {
        let errors = vec![
            CryptoError::InvalidSignature,
            CryptoError::SignatureVerificationFailed,
            CryptoError::InvalidPublicKey,
            CryptoError::InvalidPrivateKey,
            CryptoError::HashMismatch,
            CryptoError::InvalidHashAlgorithm,
            CryptoError::EncryptionFailed,
            CryptoError::DecryptionFailed,
            CryptoError::InvalidNonce,
            CryptoError::KeyDerivationFailed,
        ];

        for (i, error) in errors.iter().enumerate() {
            assert_eq!(error.code(), 1301 + i as u32);
            assert_eq!(error.category(), ErrorCategory::Cryptographic);
            assert!(!error.is_recoverable());
            assert!(!error.message().is_empty());
        }
    }

    #[test]
    fn test_all_state_errors() {
        let errors = vec![
            StateError::InvalidStateTransition,
            StateError::ContractPaused,
            StateError::ContractFrozen,
            StateError::UpgradeRequired,
            StateError::DeprecatedFunction,
            StateError::InvalidConfiguration,
            StateError::RateLimitExceeded,
            StateError::CircuitBreakerOpen,
            StateError::MaintenanceMode,
            StateError::InvalidVersion,
        ];

        for (i, error) in errors.iter().enumerate() {
            assert_eq!(error.code(), 1401 + i as u32);
            assert_eq!(error.category(), ErrorCategory::State);
            assert!(!error.message().is_empty());
        }
    }

    #[test]
    fn test_all_external_errors() {
        let errors = vec![
            ExternalError::OracleUnavailable,
            ExternalError::NetworkError,
            ExternalError::Timeout,
            ExternalError::ExternalServiceError,
            ExternalError::InvalidExternalData,
            ExternalError::BridgeUnavailable,
            ExternalError::AIServiceError,
            ExternalError::InsufficientFunds,
            ExternalError::TransactionFailed,
            ExternalError::CallbackFailed,
        ];

        for (i, error) in errors.iter().enumerate() {
            assert_eq!(error.code(), 1501 + i as u32);
            assert_eq!(error.category(), ErrorCategory::External);
            assert!(!error.message().is_empty());
        }
    }

    #[test]
    fn test_helper_functions() {
        // Test ensure
        assert!(helpers::ensure(true, ValidationError::InvalidFormat).is_ok());
        assert!(helpers::ensure(false, ValidationError::InvalidFormat).is_err());

        // Test ok_or
        assert_eq!(helpers::ok_or(Some(42), StorageError::KeyNotFound).unwrap(), 42);
        assert!(helpers::ok_or::<i32, _>(None, StorageError::KeyNotFound).is_err());
    }

    #[test]
    fn test_error_code_ranges() {
        assert!((1000..=1099).contains(&ValidationError::InvalidFormat.code()));
        assert!((1100..=1199).contains(&AuthorizationError::NotAuthorized.code()));
        assert!((1200..=1299).contains(&StorageError::KeyNotFound.code()));
        assert!((1300..=1399).contains(&CryptoError::InvalidSignature.code()));
        assert!((1400..=1499).contains(&StateError::ContractPaused.code()));
        assert!((1500..=1599).contains(&ExternalError::OracleUnavailable.code()));
    }
}
