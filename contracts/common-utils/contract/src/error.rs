//! # Contract Error Module
//!
//! Provides standardized error handling for Soroban smart contracts.

use soroban_sdk::{contracterror, Symbol, Bytes, Env};

/// Unified Contract Error Type
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    // Validation (1000+)
    InvalidFormat = 1001,
    MissingRequiredField = 1002,
    OutOfRange = 1003,
    InvalidLength = 1004,
    
    // Authorization (1100+)
    NotAuthorized = 1101,
    NotInitialized = 1109,
    AlreadyInitialized = 1110,
    
    // Storage (1200+)
    KeyNotFound = 1201,
    StorageFull = 1202,
    
    // Upgrade/Proxy (1300+)
    RegistryNotSet = 1301,
    ImplementationNotFound = 1302,
    CallFailed = 1303,
    UnauthorizedUpgrade = 1304,
    
    // Oracle/Bridge (1400+)
    OracleAlreadyExists = 1401,
    OracleNotFound = 1402,
    RequestNotFound = 1403,
    RequestAlreadyFulfilled = 1404,
    
    // Unknown
    Unknown = 9999,
}

/// Error context for providing additional information
#[soroban_sdk::contracttype]
#[derive(Clone, Debug)]
pub struct ErrorContext {
    pub operation: Symbol,
    pub field: Option<Symbol>,
    pub expected: Option<Bytes>,
    pub actual: Option<Bytes>,
    pub suggestion: Option<Symbol>,
}

impl ErrorContext {
    pub fn new(env: &Env, operation: &str) -> Self {
        Self {
            operation: Symbol::new(env, operation),
            field: None,
            expected: None,
            actual: None,
            suggestion: None,
        }
    }
}
