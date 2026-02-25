# Authorization System Guide

This guide provides comprehensive documentation for the pluggable authorization system implemented in the common-utils package.

## Overview

The authorization system provides a flexible, pluggable architecture for managing access control in Stellar smart contracts. It eliminates code duplication and provides consistent authorization patterns across all contracts.

## Core Components

### 1. IAuthorizable Trait

The core trait that all authorization models must implement:

```rust
pub trait IAuthorizable {
    fn check_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<bool, ContractError>;
    fn require_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<(), ContractError>;
    fn auth_type(&self) -> AuthType;
}
```

### 2. Permission Types

```rust
pub enum Permission {
    Admin,           // Administrative access
    Reporter,        // Can submit reports
    Viewer,          // Read-only access
    Custom(Symbol),  // Custom permission
    All(Vec<Permission>),  // Require all permissions
    Any(Vec<Permission>),  // Require any permission
}
```

### 3. Authorization Models

#### AdminOnlyAuth
Simple admin-only authorization model.

```rust
let auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
auth.require_permission(&env, &caller, &Permission::Admin)?;
```

#### RoleBasedAuth
Role-based authorization with multiple roles.

```rust
let auth = RoleBasedAuth::new(
    Symbol::new(&env, "admin"),
    Symbol::new(&env, "role")
);

// Grant roles
auth.set_role(&env, &address, &Permission::Reporter, true);
auth.set_role(&env, &address, &Permission::Viewer, true);

// Check permissions
auth.require_permission(&env, &caller, &Permission::Reporter)?;
```

#### SignatureBasedAuth
Cryptographic signature-based authorization.

```rust
let auth = SignatureBasedAuth::new(Symbol::new(&env, "bridge_pubkey"));

// Verify signature
if !auth.verify_signature(&env, &payload, &signature)? {
    return Err(CryptoError::SignatureVerificationFailed);
}
```

#### CompositeAuth
Combine multiple authorization models.

```rust
let admin_auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
let role_auth = RoleBasedAuth::new(Symbol::new(&env, "admin"), Symbol::new(&env, "role"));

// Require all auth models to approve
let composite_all = CompositeAuth::new_all(vec![
    Box::new(admin_auth),
    Box::new(role_auth)
]);

// Require any auth model to approve
let composite_any = CompositeAuth::new_any(vec![
    Box::new(admin_auth),
    Box::new(role_auth)
]);
```

## Macros

### Permission Creation

```rust
use common_utils::permission;

let admin_perm = permission!(Admin);
let reporter_perm = permission!(Reporter);
let custom_perm = permission!(Custom("my_permission"));
let all_perm = permission!(All([Admin, Reporter]));
let any_perm = permission!(Any([Admin, Viewer]));
```

### Authorization Instance Creation

```rust
use common_utils::auth;

let admin_auth = auth!(AdminOnly, "admin_key");
let role_auth = auth!(RoleBased, "admin_key", "role_prefix");
let sig_auth = auth!(SignatureBased, "pubkey_key");
```

### Authorization Checks

```rust
use common_utils::{check_authorization, with_auth};

// Simple check
check_authorization!(auth, &env, &caller, permission!(Admin));

// With protected block
with_auth!(auth, &env, &caller, permission!(Reporter), {
    // Protected code here
    let result = protected_operation();
    result
});
```

### Role Management

```rust
use common_utils::{grant_role, revoke_role, has_role};

grant_role!(auth, &env, &address, permission!(Reporter));
revoke_role!(auth, &env, &address, permission!(Reporter));
let has_role = has_role!(auth, &env, &address, permission!(Reporter));
```

## Caching

### Permission Cache

Improve performance with permission caching:

```rust
let auth = auth!(RoleBased, "admin", "role");
let cache = PermissionCache::new(300, Symbol::new(&env, "auth_cache"));
let cached_auth = cached_auth!(auth, cache);

// Permission checks are now cached for 300 seconds
cached_auth.require_permission(&env, &caller, &permission!(Reporter))?;
```

## Audit Logging

All authorization models automatically emit audit events:

```rust
// Events are emitted for both successful and failed attempts
// Event format: (auth_audit, address, permission, status, auth_type, timestamp)
```

## Implementation Examples

### Fraud Detection Contract

```rust
use common_utils::authorization::{RoleBasedAuth, Permission, PermissionCache, CachedAuth};
use common_utils::{permission, auth, cached_auth, check_authorization};

impl FraudDetectContract {
    fn get_auth(env: &Env) -> CachedAuth<RoleBasedAuth> {
        let role_auth = auth!(RoleBased, 
            Symbol::new(env, "admin"), 
            Symbol::new(env, "role")
        );
        let cache = PermissionCache::new(300, Symbol::new(env, "auth_cache"));
        cached_auth!(role_auth, cache)
    }

    pub fn add_reporter(env: Env, admin: Address, reporter: Address) -> Result<(), AuthorizationError> {
        let auth = Self::get_auth(&env);
        check_authorization!(auth, &env, &admin, permission!(Admin));
        
        // Grant reporter role
        let role_auth = RoleBasedAuth::new(
            Symbol::new(&env, "admin"), 
            Symbol::new(&env, "role")
        );
        role_auth.set_role(&env, &reporter, &permission!(Reporter), true);
        
        Ok(())
    }

    pub fn submit_report(env: Env, reporter: Address, agent_id: Symbol, score: u32) -> Result<(), AuthorizationError> {
        let auth = Self::get_auth(&env);
        check_authorization!(auth, &env, &reporter, permission!(Reporter));
        
        reporter.require_auth();
        // ... rest of implementation
    }
}
```

### Risk Evaluation Contract

```rust
use common_utils::authorization::{SignatureBasedAuth, Permission, PermissionCache, CachedAuth};
use common_utils::{permission, auth, cached_auth, check_authorization};

impl RiskEvaluationContract {
    fn get_auth(env: &Env) -> CachedAuth<SignatureBasedAuth> {
        let sig_auth = auth!(SignatureBased, Symbol::new(env, "bridge_pubkey"));
        let cache = PermissionCache::new(300, Symbol::new(env, "auth_cache"));
        cached_auth!(sig_auth, cache)
    }

    pub fn submit_risk(env: Env, attestation: RiskAttestation, signature: BytesN<64>, payload: Bytes) -> Result<(), CryptoError> {
        let auth = Self::get_auth(&env);
        
        // Verify signature
        if !auth.verify_signature(&env, &payload, &signature)? {
            return Err(CryptoError::SignatureVerificationFailed);
        }
        
        // Check custom permission
        check_authorization!(auth, &env, &attestation.agent, permission!(Custom(Symbol::new(&env, "signature"))));
        
        // ... rest of implementation
    }
}
```

## Permission Composition

### Complex Permission Logic

```rust
// Require both admin and reporter roles
let admin_and_reporter = permission!(All([Admin, Reporter]));

// Require either admin or viewer role
let admin_or_viewer = permission!(Any([Admin, Viewer]));

// Nested composition
let complex_perm = permission!(All([
    Admin,
    Any([Reporter, Viewer])
]));
```

### Composite Authorization

```rust
// Combine different auth models
let admin_auth = auth!(AdminOnly, "admin");
let sig_auth = auth!(SignatureBased, "bridge_pubkey");

// Require both admin AND valid signature
let composite = CompositeAuth::new_all(vec![
    Box::new(admin_auth),
    Box::new(sig_auth)
]);

composite.require_permission(&env, &caller, &permission!(Custom("signature")))?;
```

## Best Practices

### 1. Choose the Right Model

- **AdminOnly**: Simple contracts with single admin
- **RoleBased**: Multiple user roles needed
- **SignatureBased**: External system integration
- **Composite**: Complex authorization requirements

### 2. Use Caching

Enable caching for performance-critical contracts:

```rust
let cache = PermissionCache::new(300, Symbol::new(&env, "auth_cache"));
let cached_auth = cached_auth!(auth, cache);
```

### 3. Audit Events

Monitor authorization events for security:

```rust
// Events are automatically emitted, but you can also add custom logging
env.events().publish(
    (Symbol::new(&env, "custom_auth"),),
    (caller, action, timestamp)
);
```

### 4. Error Handling

Always handle authorization errors gracefully:

```rust
match auth.require_permission(&env, &caller, &permission) {
    Ok(()) => {
        // Authorized - proceed with operation
    }
    Err(ContractError::Unauthorized) => {
        // Log unauthorized attempt
        return Err(AuthorizationError::AccessDenied);
    }
    Err(e) => {
        // Handle other errors
        return Err(e.into());
    }
}
```

### 5. Testing

Test all authorization scenarios:

```rust
#[test]
fn test_authorization() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let user = TestAddress::generate(&env);
    
    let auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    
    // Test successful authorization
    assert!(auth.require_permission(&env, &admin, &Permission::Admin).is_ok());
    
    // Test failed authorization
    assert!(matches!(
        auth.require_permission(&env, &user, &Permission::Admin),
        Err(ContractError::Unauthorized)
    ));
}
```

## Migration Guide

### From Manual Authorization

**Before:**
```rust
let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
admin.require_auth();
```

**After:**
```rust
let auth = Self::get_auth(&env);
check_authorization!(auth, &env, &caller, permission!(Admin));
```

### From Role Checks

**Before:**
```rust
let is_reporter: bool = env.storage().instance()
    .get(&DataKey::Reporter(reporter.clone()))
    .unwrap_or(false);
if !is_reporter {
    panic!("not an approved reporter");
}
```

**After:**
```rust
let auth = Self::get_auth(&env);
check_authorization!(auth, &env, &reporter, permission!(Reporter));
```

### From Signature Verification

**Before:**
```rust
let bridge_pubkey: BytesN<32> = env.storage().instance().get(&DataKey::BridgePubKey).expect("...");
let valid = env.crypto().ed25519_verify(&bridge_pubkey, &payload, &signature);
if !valid {
    panic!("invalid signature");
}
```

**After:**
```rust
let auth = Self::get_auth(&env);
if !auth.verify_signature(&env, &payload, &signature)? {
    return Err(CryptoError::SignatureVerificationFailed);
}
```

## Security Considerations

1. **Initialization**: Ensure contracts are properly initialized before use
2. **Key Management**: Store admin keys securely
3. **Audit Trail**: Monitor authorization events for suspicious activity
4. **Permission Creep**: Regularly review and remove unnecessary permissions
5. **Replay Protection**: Implement timestamp and nonce checks for signature-based auth

## Performance Optimization

1. **Caching**: Use permission caching for frequently accessed permissions
2. **Batch Operations**: Check multiple permissions in a single call when possible
3. **Storage Optimization**: Use efficient storage patterns for role data
4. **Event Filtering**: Filter audit events to reduce storage overhead

## Testing

Run comprehensive tests:

```bash
# Test authorization system
cargo test --package common-utils --lib auth

# Test individual contracts
cargo test --package fraud-detect --lib
cargo test --package risk-eval --lib
```

## Troubleshooting

### Common Issues

1. **NotInitialized Error**: Contract not properly initialized
2. **Unauthorized Error**: Permission check failed
3. **Storage Errors**: Incorrect storage keys or data types
4. **Cache Issues**: TTL expired or cache cleared

### Debug Tips

1. Check audit events for authorization attempts
2. Verify storage keys and data types
3. Test with different permission combinations
4. Use debug logging to trace authorization flow

This authorization system provides a robust, flexible foundation for access control in Stellar smart contracts, eliminating code duplication while maintaining security and performance.
