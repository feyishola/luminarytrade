# Error Handling Patterns Guide

## Overview

This guide describes the standardized error handling patterns for ChenAIKit smart contracts using the `common-utils::error` module.

## Error Code Registry

All errors are organized into categories with standardized codes:

| Category | Code Range | Description |
|----------|------------|-------------|
| Validation | 1000-1099 | Input validation errors |
| Authorization | 1100-1199 | Permission and auth errors |
| Storage | 1200-1299 | Data storage/retrieval errors |
| Cryptographic | 1300-1399 | Crypto operation errors |
| State | 1400-1499 | Contract state errors |
| External | 1500-1599 | External service errors |
| Unknown | 9999 | Unclassified errors |

## Quick Reference

### Validation Errors (1000-1099)
- `1001` - InvalidFormat
- `1002` - MissingRequiredField
- `1003` - OutOfRange
- `1004` - InvalidLength
- `1005` - InvalidCidFormat
- `1006` - InvalidHashFormat
- `1007` - InvalidJsonStructure
- `1008` - InvalidAddress
- `1009` - InvalidTimestamp
- `1010` - InvalidSignatureFormat

### Authorization Errors (1100-1199)
- `1101` - NotAuthorized
- `1102` - InvalidAuthentication
- `1103` - InsufficientPermissions
- `1104` - NotApprovedReporter
- `1105` - AdminOnly
- `1106` - AuthorizationExpired
- `1107` - InvalidCredentials
- `1108` - AccountDisabled
- `1109` - NotInitialized
- `1110` - AlreadyInitialized

### Storage Errors (1200-1299)
- `1201` - KeyNotFound
- `1202` - StorageFull
- `1203` - DataCorruption
- `1204` - InvalidStorageKey
- `1205` - QuotaExceeded
- `1206` - ConcurrentModification
- `1207` - InvalidDataFormat
- `1208` - ExpiredData
- `1209` - MigrationFailed
- `1210` - BackupFailed

### Cryptographic Errors (1300-1399)
- `1301` - InvalidSignature
- `1302` - SignatureVerificationFailed
- `1303` - InvalidPublicKey
- `1304` - InvalidPrivateKey
- `1305` - HashMismatch
- `1306` - InvalidHashAlgorithm
- `1307` - EncryptionFailed
- `1308` - DecryptionFailed
- `1309` - InvalidNonce
- `1310` - KeyDerivationFailed

### State Errors (1400-1499)
- `1401` - InvalidStateTransition
- `1402` - ContractPaused
- `1403` - ContractFrozen
- `1404` - UpgradeRequired
- `1405` - DeprecatedFunction
- `1406` - InvalidConfiguration
- `1407` - RateLimitExceeded
- `1408` - CircuitBreakerOpen
- `1409` - MaintenanceMode
- `1410` - InvalidVersion

### External Errors (1500-1599)
- `1501` - OracleUnavailable
- `1502` - NetworkError
- `1503` - Timeout
- `1504` - ExternalServiceError
- `1505` - InvalidExternalData
- `1506` - BridgeUnavailable
- `1507` - AIServiceError
- `1508` - InsufficientFunds
- `1509` - TransactionFailed
- `1510` - CallbackFailed

## Usage Patterns

### 1. Basic Error Handling

```rust
use common_utils::error::{ValidationError, ContractError};

pub fn validate_input(data: &Bytes) -> Result<(), ValidationError> {
    if data.is_empty() {
        return Err(ValidationError::MissingRequiredField);
    }
    Ok(())
}
```

### 2. Authorization Checks

```rust
use common_utils::error::{AuthorizationError, ContractError};

pub fn admin_only_operation(env: &Env) -> Result<(), AuthorizationError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(AuthorizationError::NotInitialized)?;
    
    // Check if caller is admin
    if caller != admin {
        return Err(AuthorizationError::AdminOnly);
    }
    
    Ok(())
}
```

### 3. Storage Operations

```rust
use common_utils::error::{StorageError, ContractError};

pub fn get_stored_value(env: &Env, key: &DataKey) -> Result<Value, StorageError> {
    env.storage()
        .persistent()
        .get(key)
        .ok_or(StorageError::KeyNotFound)
}
```

### 4. Cryptographic Verification

```rust
use common_utils::error::{CryptoError, ContractError};

pub fn verify_signature(
    env: &Env,
    pubkey: &BytesN<32>,
    message: &Bytes,
    signature: &BytesN<64>,
) -> Result<(), CryptoError> {
    let valid = env.crypto().ed25519_verify(pubkey, message, signature);
    
    if !valid {
        return Err(CryptoError::SignatureVerificationFailed);
    }
    
    Ok(())
}
```

### 5. State Management

```rust
use common_utils::error::{StateError, ContractError};

pub fn initialize_contract(env: &Env, admin: Address) -> Result<(), StateError> {
    if env.storage().instance().has(&DataKey::Admin) {
        return Err(StateError::AlreadyInitialized);
    }
    
    env.storage().instance().set(&DataKey::Admin, &admin);
    Ok(())
}
```

### 6. Chaining Operations with `?`

```rust
use common_utils::error::{AuthorizationError, StorageError, ContractError};

pub fn complex_operation(env: &Env, user: Address) -> Result<Value, ContractErrorType> {
    // Check authorization
    check_permissions(env, &user)?;
    
    // Get stored data
    let data = get_stored_value(env, &DataKey::Data)?;
    
    // Validate data
    validate_data(&data)?;
    
    // Process and return
    Ok(process_data(data))
}
```

### 7. Using Helper Functions

```rust
use common_utils::error::helpers;

pub fn validate_with_helper(value: u32) -> Result<(), ValidationError> {
    helpers::ensure(
        value > 0 && value <= 100,
        ValidationError::OutOfRange
    )
}

pub fn option_to_result<T>(option: Option<T>) -> Result<T, StorageError> {
    helpers::ok_or(option, StorageError::KeyNotFound)
}
```

### 8. Error Context

```rust
use common_utils::error::ErrorContext;
use soroban_sdk::{symbol_short, Bytes};

pub fn operation_with_context(env: &Env) -> Result<(), ValidationError> {
    let context = ErrorContext::new("validate_metadata")
        .with_field("cid")
        .with_suggestion("Check CID format and try again");
    
    // Use context for logging or detailed error messages
    // Note: In Soroban, full context might be limited due to gas constraints
    
    validate_cid(env)
}
```

## Migration from panic!()

### Before (Using panic!)

```rust
pub fn initialize(env: Env, admin: Address) {
    if env.storage().instance().has(&DataKey::Admin) {
        panic!("already initialized");
    }
    env.storage().instance().set(&DataKey::Admin, &admin);
}

pub fn verify_reporter(env: &Env, reporter: &Address) {
    let is_reporter: bool = env
        .storage()
        .instance()
        .get(&DataKey::Reporter(reporter.clone()))
        .unwrap_or(false);
        
    if !is_reporter {
        panic!("not an approved reporter");
    }
}
```

### After (Using Structured Errors)

```rust
use common_utils::error::{AuthorizationError, StateError, ContractError};

pub fn initialize(env: Env, admin: Address) -> Result<(), StateError> {
    if env.storage().instance().has(&DataKey::Admin) {
        return Err(StateError::AlreadyInitialized);
    }
    env.storage().instance().set(&DataKey::Admin, &admin);
    Ok(())
}

pub fn verify_reporter(env: &Env, reporter: &Address) -> Result<(), AuthorizationError> {
    let is_reporter: bool = env
        .storage()
        .instance()
        .get(&DataKey::Reporter(reporter.clone()))
        .unwrap_or(false);
        
    if !is_reporter {
        return Err(AuthorizationError::NotApprovedReporter);
    }
    
    Ok(())
}
```

## Best Practices

1. **Always use structured errors instead of panic!()**
   - Exceptions: Only use panic! for unrecoverable bugs or invariant violations

2. **Choose the appropriate error category**
   - ValidationError for input validation
   - AuthorizationError for permission checks
   - StorageError for data operations
   - CryptoError for cryptographic operations
   - StateError for contract state issues
   - ExternalError for external service failures

3. **Return Result<T, E> from functions that can fail**
   - Don't silently ignore errors
   - Propagate errors using `?` operator

4. **Provide meaningful error messages**
   - The `ContractError` trait provides `message()` for human-readable descriptions

5. **Check error recoverability**
   - Use `is_recoverable()` to determine if an operation can be retried

6. **Document error conditions**
   - Document which errors a function can return
   - Explain when each error is returned

## Testing Error Handling

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use common_utils::error::{ValidationError, ContractError};

    #[test]
    fn test_validation_error() {
        let result = validate_input(&Bytes::new(&env));
        assert_eq!(
            result,
            Err(ValidationError::MissingRequiredField)
        );
        
        // Check error code
        assert_eq!(
            ValidationError::MissingRequiredField.code(),
            1002
        );
        
        // Check error message
        assert_eq!(
            ValidationError::MissingRequiredField.message(),
            "Missing required field"
        );
    }

    #[test]
    fn test_error_category() {
        assert_eq!(
            ValidationError::InvalidFormat.category(),
            ErrorCategory::Validation
        );
    }
}
```

## Integration with Soroban SDK

The error types implement `contracterror` which allows them to be used with Soroban's error handling:

```rust
use soroban_sdk::{contracterror, contractimpl};
use common_utils::error::ValidationError;

#[contractimpl]
impl MyContract {
    pub fn my_function(env: Env) -> Result<u32, ValidationError> {
        // Function body
        Ok(42)
    }
}
```

## Summary

- Use `Result<T, E>` for all fallible operations
- Choose appropriate error types from the registry
- Never use `panic!()` for expected error conditions
- Document error conditions in function comments
- Test both success and error paths
- Use the `?` operator for clean error propagation
