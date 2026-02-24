#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec,
};
use common_utils::error::{AuthorizationError, StateError, ContractError};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    AclContract,
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
    /// Initialize the fraud detection contract
    pub fn initialize(_env: Env) {
        // TODO: Implement contract initialization
    }

    /// Analyze transaction for fraud
    pub fn analyze_transaction(_env: Env, _transaction_data: String) -> bool {
        // TODO: Implement fraud detection logic
        false
    }

    /// Get fraud risk score
    pub fn get_risk_score(_env: Env, _transaction_data: String) -> u32 {
        // TODO: Implement risk scoring
        0
    }

    /// Get fraud indicators
    pub fn get_indicators(_env: Env, _transaction_data: String) -> Vec<String> {
        // TODO: Implement indicator analysis
        Vec::new(&_env)
    }

    /// Update fraud detection model
    pub fn update_model(_env: Env, _model_data: String) {
        // TODO: Implement model updates

    /// Initialize the fraud detection contract with an administrator and ACL contract
    pub fn initialize(env: Env, admin: Address, acl_contract: Address) -> Result<(), StateError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(StateError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::AclContract, &acl_contract);
        Ok(())
    }

    /// Add an approved reporter (ACL Managed)
    /// This function can now be called by anyone as long as they have the permission in ACL
    pub fn add_reporter(env: Env, caller: Address, reporter: Address) -> Result<(), AuthorizationError> {
        caller.require_auth();
        
        let acl: Address = env.storage().instance().get(&DataKey::AclContract).ok_or(AuthorizationError::NotInitialized)?;
        
        if !common_utils::check_permission(env.clone(), acl, caller, symbol_short!("fraud"), symbol_short!("manage")) {
            return Err(AuthorizationError::NotAuthorized);
        }

        // The actual role granting happens in the ACL contract, but we can have local state if needed.
        // For this refactor, we rely entirely on ACL for reporter status in submit_report.
        Ok(())
    }

    /// Submit a fraud score for an agent (Reporter only)
    pub fn submit_report(
        env: Env,
        reporter: Address,
        agent_id: Symbol,
        score: u32,
    ) -> Result<(), AuthorizationError> {
        reporter.require_auth();

        let acl: Address = env.storage().instance().get(&DataKey::AclContract).ok_or(AuthorizationError::NotInitialized)?;

        if !common_utils::check_permission(env.clone(), acl, reporter.clone(), symbol_short!("fraud"), symbol_short!("report")) {
            return Err(AuthorizationError::NotAuthorized);
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

#[cfg(test)]
mod test;
