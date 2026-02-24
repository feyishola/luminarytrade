//! # Data Migration Framework
//!
//! Provides a standardized way to migrate data between contract versions.

use soroban_sdk::{contracttype, Address, Env, Symbol, Vec, Val, IntoVal};
use crate::error::CommonError;

/// Trait to be implemented by contracts that support data migration
pub trait DataMigration {
    /// Export state for migration
    fn export_state(env: Env) -> Vec<Val>;
    
    /// Import state from a previous version
    fn import_state(env: Env, data: Vec<Val>) -> Result<(), CommonError>;
}

/// Runner to coordinate migrations between implementations
pub struct MigrationRunner;

impl MigrationRunner {
    /// Run migration from one contract to another
    pub fn run_migration(
        env: &Env,
        from: &Address,
        to: &Address,
        admin: &Address,
    ) -> Result<(), CommonError> {
        admin.require_auth();
        
        // Export state from current implementation
        // The contract should have: pub fn export_state(env: Env) -> Vec<Val>
        let state: Vec<Val> = env.invoke_contract(
            from,
            &Symbol::new(env, "export_state"),
            soroban_sdk::vec![env],
        );
        
        // Import state into new implementation
        // The contract should have: pub fn import_state(env: Env, data: Vec<Val>) -> Result<(), CommonError>
        let _: Val = env.invoke_contract(
            to,
            &Symbol::new(env, "import_state"),
            soroban_sdk::vec![env, state.into_val(env)],
        );
        
        Ok(())
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct MigrationConfig {
    pub runner: Address,
    pub is_active: bool,
}
