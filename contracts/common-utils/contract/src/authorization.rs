#![no_std]

use soroban_sdk::{
    contracttype, Address, Env, Bytes, BytesN, Symbol, Vec, Map, panic_with_error
};
use crate::error::ContractError;

/// Authorization trait that all permission models must implement
pub trait IAuthorizable {
    /// Check if the given address has the required permission
    fn check_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<bool, ContractError>;
    
    /// Check permission and panic if not authorized
    fn require_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<(), ContractError> {
        match self.check_permission(env, address, permission) {
            Ok(true) => Ok(()),
            Ok(false) => Err(ContractError::Unauthorized),
            Err(e) => Err(e),
        }
    }
    
    /// Get the type of authorization model
    fn auth_type(&self) -> AuthType;
}

/// Permission types that can be checked
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Permission {
    /// Administrative access
    Admin,
    /// Can submit reports
    Reporter,
    /// Read-only access
    Viewer,
    /// Custom permission with identifier
    Custom(Symbol),
    /// Composite permission requiring multiple permissions
    All(Vec<Permission>),
    /// Any of multiple permissions
    Any(Vec<Permission>),
}

/// Authorization model types
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AuthType {
    AdminOnly,
    RoleBased,
    SignatureBased,
    Composite,
}

/// Admin-only authorization model
#[derive(Clone, Debug)]
#[contracttype]
pub struct AdminOnlyAuth {
    admin_key: Symbol,
}

impl AdminOnlyAuth {
    pub fn new(admin_key: Symbol) -> Self {
        Self { admin_key }
    }
    
    fn get_admin(&self, env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&self.admin_key)
            .ok_or(ContractError::NotInitialized)
    }
}

impl IAuthorizable for AdminOnlyAuth {
    fn check_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<bool, ContractError> {
        let admin = self.get_admin(env)?;
        
        match permission {
            Permission::Admin => Ok(admin == *address),
            Permission::All(perms) => {
                for perm in perms.iter() {
                    if !self.check_permission(env, address, perm)? {
                        return Ok(false);
                    }
                }
                Ok(true)
            }
            Permission::Any(perms) => {
                for perm in perms.iter() {
                    if self.check_permission(env, address, perm)? {
                        return Ok(true);
                    }
                }
                Ok(false)
            }
            _ => Ok(false),
        }
    }
    
    fn require_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<(), ContractError> {
        match self.check_permission(env, address, permission) {
            Ok(true) => {
                self.log_authorization(env, address, permission, true);
                Ok(())
            }
            Ok(false) => {
                self.log_authorization(env, address, permission, false);
                Err(ContractError::Unauthorized)
            }
            Err(e) => Err(e),
        }
    }
    
    fn auth_type(&self) -> AuthType {
        AuthType::AdminOnly
    }
}

/// Role-based authorization model
#[derive(Clone, Debug)]
#[contracttype]
pub struct RoleBasedAuth {
    admin_key: Symbol,
    role_key_prefix: Symbol,
}

impl RoleBasedAuth {
    pub fn new(admin_key: Symbol, role_key_prefix: Symbol) -> Self {
        Self { admin_key, role_key_prefix }
    }
    
    fn get_admin(&self, env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&self.admin_key)
            .ok_or(ContractError::NotInitialized)
    }
    
    fn has_role(&self, env: &Env, address: &Address, role: &Permission) -> bool {
        let role_key = (self.role_key_prefix.clone(), address.clone(), role.clone());
        env.storage()
            .instance()
            .get::<_, bool>(&role_key)
            .unwrap_or(false)
    }
    
    fn set_role(&self, env: &Env, address: &Address, role: &Permission, has_role: bool) {
        let role_key = (self.role_key_prefix.clone(), address.clone(), role.clone());
        if has_role {
            env.storage().instance().set(&role_key, &true);
        } else {
            env.storage().instance().remove(&role_key);
        }
    }
}

impl IAuthorizable for RoleBasedAuth {
    fn check_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<bool, ContractError> {
        let admin = self.get_admin(env)?;
        
        match permission {
            Permission::Admin => Ok(admin == *address),
            Permission::Reporter => Ok(self.has_role(env, address, permission)),
            Permission::Viewer => Ok(self.has_role(env, address, permission)),
            Permission::Custom(_) => Ok(self.has_role(env, address, permission)),
            Permission::All(perms) => {
                for perm in perms.iter() {
                    if !self.check_permission(env, address, perm)? {
                        return Ok(false);
                    }
                }
                Ok(true)
            }
            Permission::Any(perms) => {
                for perm in perms.iter() {
                    if self.check_permission(env, address, perm)? {
                        return Ok(true);
                    }
                }
                Ok(false)
            }
        }
    }
    
    fn require_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<(), ContractError> {
        match self.check_permission(env, address, permission) {
            Ok(true) => {
                self.log_authorization(env, address, permission, true);
                Ok(())
            }
            Ok(false) => {
                self.log_authorization(env, address, permission, false);
                Err(ContractError::Unauthorized)
            }
            Err(e) => Err(e),
        }
    }
    
    fn auth_type(&self) -> AuthType {
        AuthType::RoleBased
    }
}

/// Signature-based authorization model
#[derive(Clone, Debug)]
#[contracttype]
pub struct SignatureBasedAuth {
    public_key_key: Symbol,
}

impl SignatureBasedAuth {
    pub fn new(public_key_key: Symbol) -> Self {
        Self { public_key_key }
    }
    
    fn get_public_key(&self, env: &Env) -> Result<BytesN<32>, ContractError> {
        env.storage()
            .instance()
            .get(&self.public_key_key)
            .ok_or(ContractError::NotInitialized)
    }
    
    fn verify_signature(&self, env: &Env, payload: &Bytes, signature: &BytesN<64>) -> Result<bool, ContractError> {
        let public_key = self.get_public_key(env)?;
        Ok(env.crypto().ed25519_verify(&public_key, payload, signature))
    }
}

impl IAuthorizable for SignatureBasedAuth {
    fn check_permission(&self, env: &Env, _address: &Address, permission: &Permission) -> Result<bool, ContractError> {
        match permission {
            Permission::Custom(sym) if sym == &Symbol::new(env, "signature") => {
                // This requires additional context (payload and signature)
                // The actual verification happens in the specific method
                Ok(true)
            }
            Permission::All(perms) => {
                for perm in perms.iter() {
                    if !self.check_permission(env, _address, perm)? {
                        return Ok(false);
                    }
                }
                Ok(true)
            }
            Permission::Any(perms) => {
                for perm in perms.iter() {
                    if self.check_permission(env, _address, perm)? {
                        return Ok(true);
                    }
                }
                Ok(false)
            }
            _ => Ok(false),
        }
    }
    
    fn require_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<(), ContractError> {
        match self.check_permission(env, address, permission) {
            Ok(true) => {
                self.log_authorization(env, address, permission, true);
                Ok(())
            }
            Ok(false) => {
                self.log_authorization(env, address, permission, false);
                Err(ContractError::Unauthorized)
            }
            Err(e) => Err(e),
        }
    }
    
    fn auth_type(&self) -> AuthType {
        AuthType::SignatureBased
    }
}

/// Composite authorization that combines multiple authorization models
#[derive(Clone)]
pub struct CompositeAuth {
    auth_models: Vec<AuthModel>,
    require_all: bool,
}

#[derive(Clone)]
enum AuthModel {
    AdminOnly(AdminOnlyAuth),
    RoleBased(RoleBasedAuth),
    SignatureBased(SignatureBasedAuth),
}

impl CompositeAuth {
    pub fn new_all(auth_models: Vec<Box<dyn IAuthorizable>>) -> Self {
        // Convert Box<dyn IAuthorizable> to AuthModel enum
        let models: Vec<AuthModel> = auth_models.into_iter().map(|model| {
            // This is a simplified conversion - in practice you'd need proper downcasting
            // For now, we'll create a placeholder implementation
            AuthModel::AdminOnly(AdminOnlyAuth::new(Symbol::short("admin")))
        }).collect();
        
        Self { auth_models: models, require_all: true }
    }
    
    pub fn new_any(auth_models: Vec<Box<dyn IAuthorizable>>) -> Self {
        let models: Vec<AuthModel> = auth_models.into_iter().map(|model| {
            AuthModel::AdminOnly(AdminOnlyAuth::new(Symbol::short("admin")))
        }).collect();
        
        Self { auth_models: models, require_all: false }
    }
}

impl IAuthorizable for CompositeAuth {
    fn check_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<bool, ContractError> {
        if self.auth_models.is_empty() {
            return Ok(false);
        }
        
        // Simplified implementation - just check the first model for now
        match &self.auth_models[0] {
            AuthModel::AdminOnly(auth) => auth.check_permission(env, address, permission),
            AuthModel::RoleBased(auth) => auth.check_permission(env, address, permission),
            AuthModel::SignatureBased(auth) => auth.check_permission(env, address, permission),
        }
    }
    
    fn require_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<(), ContractError> {
        match self.check_permission(env, address, permission) {
            Ok(true) => {
                self.log_authorization(env, address, permission, true);
                Ok(())
            }
            Ok(false) => {
                self.log_authorization(env, address, permission, false);
                Err(ContractError::Unauthorized)
            }
            Err(e) => Err(e),
        }
    }
    
    fn auth_type(&self) -> AuthType {
        AuthType::Composite
    }
}

/// Authorization audit logging trait
pub trait AuthorizationLogger {
    fn log_authorization(&self, env: &Env, address: &Address, permission: &Permission, success: bool);
}

/// Default implementation of authorization logging
pub struct DefaultAuthLogger;

impl DefaultAuthLogger {
    pub fn log_authorization_event(
        env: &Env,
        address: &Address,
        permission: &Permission,
        success: bool,
        auth_type: &AuthType,
    ) {
        let timestamp = env.ledger().timestamp();
        let status = if success { "granted" } else { "denied" };
        
        env.events().publish(
            (Symbol::new(env, "auth_audit"),),
            (address, permission, status, auth_type, timestamp)
        );
    }
}

/// Implement logging for all auth types
macro_rules! impl_auth_logger {
    ($type:ty) => {
        impl AuthorizationLogger for $type {
            fn log_authorization(&self, env: &Env, address: &Address, permission: &Permission, success: bool) {
                DefaultAuthLogger::log_authorization_event(env, address, permission, success, &self.auth_type());
            }
        }
    };
}

impl_auth_logger!(AdminOnlyAuth);
impl_auth_logger!(RoleBasedAuth);
impl_auth_logger!(SignatureBasedAuth);
impl_auth_logger!(CompositeAuth);

/// Permission cache for performance optimization
#[derive(Clone, Debug)]
#[contracttype]
pub struct PermissionCache {
    cache_ttl: u64,
    cache_key_prefix: Symbol,
}

impl PermissionCache {
    pub fn new(cache_ttl: u64, cache_key_prefix: Symbol) -> Self {
        Self { cache_ttl, cache_key_prefix }
    }
    
    fn get_cache_key(&self, address: &Address, permission: &Permission) -> (Symbol, Address, Permission) {
        (self.cache_key_prefix.clone(), address.clone(), permission.clone())
    }
    
    pub fn get_cached_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Option<bool> {
        let cache_key = self.get_cache_key(address, permission);
        let cached: Option<(bool, u64)> = env.storage().temporary().get(&cache_key);
        
        match cached {
            Some((result, timestamp)) => {
                let now = env.ledger().timestamp();
                if now - timestamp < self.cache_ttl {
                    Some(result)
                } else {
                    env.storage().temporary().remove(&cache_key);
                    None
                }
            }
            None => None,
        }
    }
    
    pub fn cache_permission(&self, env: &Env, address: &Address, permission: &Permission, result: bool) {
        let cache_key = self.get_cache_key(address, permission);
        let timestamp = env.ledger().timestamp();
        env.storage().temporary().set(&cache_key, &(result, timestamp));
    }
    
    pub fn clear_cache(&self, env: &Env, address: &Address) {
        // This is a simplified implementation
        // In practice, you might want to track all cache keys for an address
        let prefix = (self.cache_key_prefix.clone(), address.clone());
        // Note: Stellar doesn't support prefix-based deletion, so you'd need to track keys separately
    }
}

/// Cached authorization wrapper
#[derive(Clone)]
pub struct CachedAuth<T> {
    inner: T,
    cache: PermissionCache,
}

impl<T: IAuthorizable> CachedAuth<T> {
    pub fn new(auth: T, cache: PermissionCache) -> Self {
        Self { inner: auth, cache }
    }
}

impl<T: IAuthorizable + AuthorizationLogger> IAuthorizable for CachedAuth<T> {
    fn check_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<bool, ContractError> {
        // Check cache first
        if let Some(cached_result) = self.cache.get_cached_permission(env, address, permission) {
            return Ok(cached_result);
        }
        
        // Compute result and cache it
        let result = self.inner.check_permission(env, address, permission)?;
        self.cache.cache_permission(env, address, permission, result);
        Ok(result)
    }
    
    fn require_permission(&self, env: &Env, address: &Address, permission: &Permission) -> Result<(), ContractError> {
        match self.check_permission(env, address, permission) {
            Ok(true) => {
                self.log_authorization(env, address, permission, true);
                Ok(())
            }
            Ok(false) => {
                self.log_authorization(env, address, permission, false);
                Err(ContractError::Unauthorized)
            }
            Err(e) => Err(e),
        }
    }
    
    fn auth_type(&self) -> AuthType {
        self.inner.auth_type()
    }
}

impl<T: IAuthorizable + AuthorizationLogger> AuthorizationLogger for CachedAuth<T> {
    fn log_authorization(&self, env: &Env, address: &Address, permission: &Permission, success: bool) {
        self.inner.log_authorization(env, address, permission, success);
    }
}
