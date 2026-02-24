//! Storage Utilities
//! Provides common storage keys and helpers.

use soroban_sdk::Env;

pub struct ContractStorage;

impl ContractStorage {
    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&soroban_sdk::symbol_short!("admin"))
    }
}
