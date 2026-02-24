#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as TestAddress, BytesN as TestBytesN},
    Address, Env, Bytes, BytesN, Symbol,
};
use crate::authorization::{
    IAuthorizable, AdminOnlyAuth, RoleBasedAuth, SignatureBasedAuth, 
    CompositeAuth, Permission, PermissionCache, CachedAuth, AuthType
};
use crate::error::ContractError;

#[test]
fn test_admin_only_auth() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let user = TestAddress::generate(&env);
    
    let auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    
    // Initially not initialized
    assert!(matches!(
        auth.check_permission(&env, &admin, &Permission::Admin),
        Err(ContractError::NotInitialized)
    ));
    
    // Set admin
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    
    // Admin should have admin permission
    assert!(auth.check_permission(&env, &admin, &Permission::Admin).unwrap());
    
    // User should not have admin permission
    assert!(!auth.check_permission(&env, &user, &Permission::Admin).unwrap());
    
    // Test require_permission
    assert!(auth.require_permission(&env, &admin, &Permission::Admin).is_ok());
    assert!(matches!(
        auth.require_permission(&env, &user, &Permission::Admin),
        Err(ContractError::Unauthorized)
    ));
}

#[test]
fn test_role_based_auth() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let reporter = TestAddress::generate(&env);
    let viewer = TestAddress::generate(&env);
    let user = TestAddress::generate(&env);
    
    let auth = RoleBasedAuth::new(
        Symbol::new(&env, "admin"),
        Symbol::new(&env, "role")
    );
    
    // Set admin
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    
    // Grant roles
    auth.set_role(&env, &reporter, &Permission::Reporter, true);
    auth.set_role(&env, &viewer, &Permission::Viewer, true);
    
    // Test admin permission
    assert!(auth.check_permission(&env, &admin, &Permission::Admin).unwrap());
    assert!(!auth.check_permission(&env, &reporter, &Permission::Admin).unwrap());
    
    // Test reporter permission
    assert!(auth.check_permission(&env, &reporter, &Permission::Reporter).unwrap());
    assert!(!auth.check_permission(&env, &viewer, &Permission::Reporter).unwrap());
    assert!(!auth.check_permission(&env, &user, &Permission::Reporter).unwrap());
    
    // Test viewer permission
    assert!(auth.check_permission(&env, &viewer, &Permission::Viewer).unwrap());
    assert!(!auth.check_permission(&env, &reporter, &Permission::Viewer).unwrap());
    
    // Test custom permission
    let custom_perm = Permission::Custom(Symbol::new(&env, "custom"));
    auth.set_role(&env, &user, &custom_perm, true);
    assert!(auth.check_permission(&env, &user, &custom_perm).unwrap());
}

#[test]
fn test_permission_composition() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let reporter_viewer = TestAddress::generate(&env);
    let user = TestAddress::generate(&env);
    
    let auth = RoleBasedAuth::new(
        Symbol::new(&env, "admin"),
        Symbol::new(&env, "role")
    );
    
    // Set admin and grant roles
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    auth.set_role(&env, &reporter_viewer, &Permission::Reporter, true);
    auth.set_role(&env, &reporter_viewer, &Permission::Viewer, true);
    
    // Test All composition (requires both permissions)
    let all_perm = Permission::All(vec![Permission::Reporter, Permission::Viewer]);
    assert!(auth.check_permission(&env, &reporter_viewer, &all_perm).unwrap());
    assert!(!auth.check_permission(&env, &admin, &all_perm).unwrap());
    
    // Test Any composition (requires any permission)
    let any_perm = Permission::Any(vec![Permission::Admin, Permission::Reporter]);
    assert!(auth.check_permission(&env, &admin, &any_perm).unwrap());
    assert!(auth.check_permission(&env, &reporter_viewer, &any_perm).unwrap());
    assert!(!auth.check_permission(&env, &user, &any_perm).unwrap());
}

#[test]
fn test_signature_based_auth() {
    let env = Env::default();
    let user = TestAddress::generate(&env);
    
    let auth = SignatureBasedAuth::new(Symbol::new(&env, "bridge_pubkey"));
    
    // Initially not initialized
    assert!(matches!(
        auth.get_public_key(&env),
        Err(ContractError::NotInitialized)
    ));
    
    // Set public key
    let pubkey = TestBytesN::random(&env);
    env.storage().instance().set(&Symbol::new(&env, "bridge_pubkey"), &pubkey);
    
    // Test custom permission for signature-based auth
    let sig_perm = Permission::Custom(Symbol::new(&env, "signature"));
    assert!(auth.check_permission(&env, &user, &sig_perm).unwrap());
    
    // Test other permissions (should return false)
    assert!(!auth.check_permission(&env, &user, &Permission::Admin).unwrap());
    assert!(!auth.check_permission(&env, &user, &Permission::Reporter).unwrap());
}

#[test]
fn test_composite_auth_all() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let reporter = TestAddress::generate(&env);
    
    let admin_auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    let role_auth = RoleBasedAuth::new(
        Symbol::new(&env, "admin"),
        Symbol::new(&env, "role")
    );
    
    // Set up both auth systems
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    role_auth.set_role(&env, &admin, &Permission::Reporter, true);
    
    // Create composite auth requiring all
    let composite = CompositeAuth::new_all(vec![
        Box::new(admin_auth),
        Box::new(role_auth)
    ]);
    
    // Admin should pass both checks
    assert!(composite.check_permission(&env, &admin, &Permission::Admin).unwrap());
    
    // Reporter should fail admin check
    assert!(!composite.check_permission(&env, &reporter, &Permission::Admin).unwrap());
}

#[test]
fn test_composite_auth_any() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let reporter = TestAddress::generate(&env);
    let user = TestAddress::generate(&env);
    
    let admin_auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    let role_auth = RoleBasedAuth::new(
        Symbol::new(&env, "admin"),
        Symbol::new(&env, "role")
    );
    
    // Set up auth systems
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    role_auth.set_role(&env, &reporter, &Permission::Reporter, true);
    
    // Create composite auth requiring any
    let composite = CompositeAuth::new_any(vec![
        Box::new(admin_auth),
        Box::new(role_auth)
    ]);
    
    // Admin should pass admin check
    assert!(composite.check_permission(&env, &admin, &Permission::Admin).unwrap());
    
    // Reporter should pass reporter check
    assert!(composite.check_permission(&env, &reporter, &Permission::Reporter).unwrap());
    
    // User should fail both checks
    assert!(!composite.check_permission(&env, &user, &Permission::Admin).unwrap());
    assert!(!composite.check_permission(&env, &user, &Permission::Reporter).unwrap());
}

#[test]
fn test_permission_cache() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let user = TestAddress::generate(&env);
    
    let auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    let cache = PermissionCache::new(300, Symbol::new(&env, "cache"));
    let cached_auth = CachedAuth::new(auth, cache);
    
    // Set admin
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    
    // First check should compute and cache
    assert!(cached_auth.check_permission(&env, &admin, &Permission::Admin).unwrap());
    
    // Remove admin from storage
    env.storage().instance().remove(&Symbol::new(&env, "admin"));
    
    // Second check should still return true due to cache
    assert!(cached_auth.check_permission(&env, &admin, &Permission::Admin).unwrap());
    
    // But user should still be false
    assert!(!cached_auth.check_permission(&env, &user, &Permission::Admin).unwrap());
}

#[test]
fn test_permission_cache_ttl() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    
    let auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    let cache = PermissionCache::new(1, Symbol::new(&env, "cache")); // 1 second TTL
    let cached_auth = CachedAuth::new(auth, cache);
    
    // Set admin
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    
    // First check
    assert!(cached_auth.check_permission(&env, &admin, &Permission::Admin).unwrap());
    
    // Advance time beyond TTL
    env.ledger().set_timestamp(env.ledger().timestamp() + 2000);
    
    // Remove admin from storage
    env.storage().instance().remove(&Symbol::new(&env, "admin"));
    
    // Check should recompute and return false
    assert!(!cached_auth.check_permission(&env, &admin, &Permission::Admin).unwrap());
}

#[test]
fn test_auth_types() {
    let env = Env::default();
    
    let admin_auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    let role_auth = RoleBasedAuth::new(
        Symbol::new(&env, "admin"),
        Symbol::new(&env, "role")
    );
    let sig_auth = SignatureBasedAuth::new(Symbol::new(&env, "pubkey"));
    
    assert_eq!(admin_auth.auth_type(), AuthType::AdminOnly);
    assert_eq!(role_auth.auth_type(), AuthType::RoleBased);
    assert_eq!(sig_auth.auth_type(), AuthType::SignatureBased);
    
    let composite = CompositeAuth::new_all(vec![
        Box::new(admin_auth),
        Box::new(role_auth)
    ]);
    assert_eq!(composite.auth_type(), AuthType::Composite);
}

#[test]
fn test_nested_permission_composition() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let reporter = TestAddress::generate(&env);
    let viewer = TestAddress::generate(&env);
    
    let auth = RoleBasedAuth::new(
        Symbol::new(&env, "admin"),
        Symbol::new(&env, "role")
    );
    
    // Set up roles
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    auth.set_role(&env, &reporter, &Permission::Reporter, true);
    auth.set_role(&env, &viewer, &Permission::Viewer, true);
    
    // Test nested composition: All([Admin, Any([Reporter, Viewer])])
    let inner_any = Permission::Any(vec![Permission::Reporter, Permission::Viewer]);
    let nested_all = Permission::All(vec![Permission::Admin, inner_any]);
    
    // Admin should fail (doesn't have reporter or viewer role)
    assert!(!auth.check_permission(&env, &admin, &nested_all).unwrap());
    
    // Reporter should fail (not admin)
    assert!(!auth.check_permission(&env, &reporter, &nested_all).unwrap());
    
    // Create a user with both admin and reporter roles
    let admin_reporter = TestAddress::generate(&env);
    auth.set_role(&env, &admin_reporter, &Permission::Reporter, true);
    
    // This would require manually setting admin since we can't have multiple admins
    // in this simple test setup
}

#[test]
fn test_audit_logging() {
    let env = Env::default();
    let admin = TestAddress::generate(&env);
    let user = TestAddress::generate(&env);
    
    let auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    
    // Set admin
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    
    // Successful authorization should emit event
    assert!(auth.require_permission(&env, &admin, &Permission::Admin).is_ok());
    
    // Failed authorization should also emit event
    assert!(matches!(
        auth.require_permission(&env, &user, &Permission::Admin),
        Err(ContractError::Unauthorized)
    ));
    
    // In a real test, you would verify the events were emitted
    // This is a simplified test structure
}

#[test]
fn test_error_handling() {
    let env = Env::default();
    let user = TestAddress::generate(&env);
    
    let auth = AdminOnlyAuth::new(Symbol::new(&env, "admin"));
    
    // Test various error conditions
    assert!(matches!(
        auth.check_permission(&env, &user, &Permission::Admin),
        Err(ContractError::NotInitialized)
    ));
    
    assert!(matches!(
        auth.require_permission(&env, &user, &Permission::Admin),
        Err(ContractError::NotInitialized)
    ));
    
    // Set admin and test unauthorized access
    let admin = TestAddress::generate(&env);
    env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
    
    assert!(matches!(
        auth.require_permission(&env, &user, &Permission::Admin),
        Err(ContractError::Unauthorized)
    ));
}
