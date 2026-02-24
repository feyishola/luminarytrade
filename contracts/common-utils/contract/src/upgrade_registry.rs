//! Upgrade Registry Contract
//! Manages the mapping between contract names and their current implementation addresses.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short};
use crate::error::CommonError;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ImplementationInfo {
    pub implementation: Address,
    pub version: u32,
    pub deployed_at: u64,
    pub migration_hash: Option<soroban_sdk::BytesN<32>>,
}

#[contracttype]
pub enum RegistryKey {
    Admin,
    CurrentImpl(Symbol),
    VersionHistory(Symbol, u32),
    TotalVersions(Symbol),
}

#[contract]
pub struct UpgradeRegistry;

#[contractimpl]
impl UpgradeRegistry {
    /// Initialize the registry with admin address
    pub fn initialize(env: Env, admin: Address) -> Result<(), CommonError> {
        if env.storage().instance().has(&RegistryKey::Admin) {
            return Err(CommonError::AlreadyInitialized);
        }
        env.storage().instance().set(&RegistryKey::Admin, &admin);
        Ok(())
    }

    /// Register a new implementation for a contract
    pub fn register_implementation(
        env: Env,
        admin: Address,
        contract_name: Symbol,
        implementation: Address,
        version: u32,
        migration_hash: Option<soroban_sdk::BytesN<32>>,
    ) -> Result<(), CommonError> {
        // Verify admin authorization
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&RegistryKey::Admin).ok_or(CommonError::NotInitialized)?;
        
        if stored_admin != admin {
            return Err(CommonError::NotAuthorized);
        }

        // Store the implementation info
        let info = ImplementationInfo {
            implementation: implementation.clone(),
            version,
            deployed_at: env.ledger().timestamp(),
            migration_hash,
        };

        // Update current implementation
        env.storage()
            .persistent()
            .set(&RegistryKey::CurrentImpl(contract_name.clone()), &info);

        // Store in history
        env.storage()
            .persistent()
            .set(&RegistryKey::VersionHistory(contract_name.clone(), version), &info);

        // Update total versions count
        let total = env.storage().persistent().get(&RegistryKey::TotalVersions(contract_name.clone())).unwrap_or(0u32);
        if version > total {
            env.storage().persistent().set(&RegistryKey::TotalVersions(contract_name.clone()), &version);
        }

        // Emit event
        env.events().publish(
            (symbol_short!("reg_impl"), contract_name),
            (implementation, version),
        );
        
        Ok(())
    }

    /// Rollback a contract to a previous version
    pub fn rollback(
        env: Env,
        admin: Address,
        contract_name: Symbol,
        version: u32,
    ) -> Result<(), CommonError> {
        // Verify admin authorization
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&RegistryKey::Admin).ok_or(CommonError::NotInitialized)?;
        
        if stored_admin != admin {
            return Err(CommonError::NotAuthorized);
        }

        // Get the historical info
        let info = env.storage().persistent().get::<_, ImplementationInfo>(&RegistryKey::VersionHistory(contract_name.clone(), version)).ok_or(CommonError::ImplementationNotFound)?;

        // Update current implementation to this historical one
        env.storage()
            .persistent()
            .set(&RegistryKey::CurrentImpl(contract_name.clone()), &info);

        // Emit rollback event
        env.events().publish(
            (symbol_short!("rollback"), contract_name),
            (info.implementation, version),
        );
        
        Ok(())
    }

    /// Get current implementation for a contract
    pub fn get_implementation(env: Env, contract_name: Symbol) -> Option<Address> {
        env.storage()
            .persistent()
            .get::<_, ImplementationInfo>(&RegistryKey::CurrentImpl(contract_name))
            .map(|info| info.implementation)
    }

    /// Get implementation info for a contract
    pub fn get_implementation_info(env: Env, contract_name: Symbol) -> Option<ImplementationInfo> {
        env.storage()
            .persistent()
            .get(&RegistryKey::CurrentImpl(contract_name))
    }

    /// Get implementation at a specific version
    pub fn get_implementation_at_version(env: Env, contract_name: Symbol, version: u32) -> Option<ImplementationInfo> {
        env.storage()
            .persistent()
            .get(&RegistryKey::VersionHistory(contract_name, version))
    }

    /// Check if a contract has a registered implementation
    pub fn has_implementation(env: Env, contract_name: Symbol) -> bool {
        env.storage()
            .persistent()
            .has(&RegistryKey::CurrentImpl(contract_name))
    }

    /// Get all versions for a contract
    pub fn get_version_history(env: Env, contract_name: Symbol) -> soroban_sdk::Vec<ImplementationInfo> {
        let total = env.storage().persistent().get(&RegistryKey::TotalVersions(contract_name.clone())).unwrap_or(0u32);
        let mut history = soroban_sdk::Vec::new(&env);
        for i in 1..=total {
            if let Some(info) = env.storage().persistent().get::<_, ImplementationInfo>(&RegistryKey::VersionHistory(contract_name.clone(), i)) {
                history.push_back(info);
            }
        }
        history
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Result<Address, CommonError> {
        env.storage()
            .instance()
            .get(&RegistryKey::Admin)
            .ok_or(CommonError::NotInitialized)
    }
}