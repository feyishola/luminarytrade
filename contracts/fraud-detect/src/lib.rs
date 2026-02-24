//! # Fraud Detection Contract
//!
//! Analyzes transactions for potential fraud and manages fraud reports.

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec, Val, TryFromVal,
};
use common_utils::error::CommonError;
use common_utils::migration::DataMigration;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Reporter(Address),
    Reports(Symbol),
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct FraudReport {
    pub score: u32,
    pub reporter: Address,
    pub timestamp: u64,
}

#[contract]
pub struct FraudDetectContract;

#[contractimpl]
impl FraudDetectContract {
    /// Initialize the fraud detection contract with an administrator
    pub fn initialize(env: Env, admin: Address) -> Result<(), CommonError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(CommonError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        
        env.events().publish(
            (symbol_short!("init"),),
            admin,
        );
        Ok(())
    }

    /// Add an approved reporter (Admin only)
    pub fn add_reporter(env: Env, reporter: Address) -> Result<(), CommonError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(CommonError::NotInitialized)?;
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::Reporter(reporter.clone()), &true);
        
        env.events().publish(
            (symbol_short!("add_rpt"),),
            reporter,
        );
        Ok(())
    }

    /// Remove an approved reporter (Admin only)
    pub fn remove_reporter(env: Env, reporter: Address) -> Result<(), CommonError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(CommonError::NotInitialized)?;
        admin.require_auth();
        
        env.storage().instance().remove(&DataKey::Reporter(reporter.clone()));
        
        env.events().publish(
            (symbol_short!("rem_rpt"),),
            reporter,
        );
        Ok(())
    }

    /// Submit a fraud score for an agent (Reporter only)
    pub fn submit_report(
        env: Env,
        reporter: Address,
        agent_id: Symbol,
        score: u32,
    ) -> Result<(), CommonError> {
        reporter.require_auth();

        let is_reporter: bool = env
            .storage()
            .instance()
            .get(&DataKey::Reporter(reporter.clone()))
            .unwrap_or(false);

        if !is_reporter {
            return Err(CommonError::NotAuthorized);
        }

        let mut reports: Vec<FraudReport> = env
            .storage()
            .instance()
            .get(&DataKey::Reports(agent_id.clone()))
            .unwrap_or(Vec::new(&env));

        let report = FraudReport {
            score,
            reporter: reporter.clone(),
            timestamp: env.ledger().timestamp(),
        };

        reports.push_back(report);
        env.storage()
            .instance()
            .set(&DataKey::Reports(agent_id.clone()), &reports);

        // Emit event
        env.events().publish(
            (symbol_short!("fraud_rpt"), agent_id),
            (reporter, score, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Retrieve all fraud reports for a given agent ID
    pub fn get_reports(env: Env, agent_id: Symbol) -> Vec<FraudReport> {
        env.storage()
            .instance()
            .get(&DataKey::Reports(agent_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Get the latest fraud score for a given agent ID
    pub fn get_latest_score(env: Env, agent_id: Symbol) -> u32 {
        let reports: Vec<FraudReport> = env
            .storage()
            .instance()
            .get(&DataKey::Reports(agent_id))
            .unwrap_or(Vec::new(&env));

        if reports.is_empty() {
            0
        } else {
            reports.get(reports.len() - 1).unwrap().score
        }
    }
}

#[contractimpl]
impl DataMigration for FraudDetectContract {
    fn export_state(env: Env) -> Vec<Val> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        let mut state = Vec::new(&env);
        state.push_back(admin.to_val());
        state
    }

    fn import_state(env: Env, data: Vec<Val>) -> Result<(), CommonError> {
        if data.len() < 1 {
            return Err(CommonError::InvalidFormat);
        }
        let val = data.get(0).unwrap();
        let admin = Address::try_from_val(&env, &val).map_err(|_| CommonError::InvalidFormat)?;
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }
}

#[cfg(test)]
mod test;
