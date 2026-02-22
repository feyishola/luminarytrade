#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};
use common_utils::error::{AuthorizationError, StateError, ValidationError, ContractError};

#[contracttype]
pub enum DataKey {
    Admin,
    Score(Address),
    Factors(Address),
}

#[contract]
pub struct CreditScoreContract;

#[contractimpl]
impl CreditScoreContract {
    /// Initialize the credit score contract
    pub fn initialize(env: Env, admin: Address) -> Result<(), StateError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(StateError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Calculate credit score for an account
    pub fn calculate_score(
        env: Env,
        account_id: String,
    ) -> Result<u32, ValidationError> {
        // Validate account_id is not empty
        if account_id.is_empty() {
            return Err(ValidationError::MissingRequiredField);
        }

        // TODO: Implement credit scoring logic
        // For now, return a default score
        Ok(500)
    }

    /// Get credit score for an account
    pub fn get_score(env: Env, account_id: Address) -> Result<u32, AuthorizationError> {
        env.storage()
            .persistent()
            .get(&DataKey::Score(account_id))
            .ok_or(AuthorizationError::NotAuthorized)
    }

    /// Update credit score factors (Admin only)
    pub fn update_factors(
        env: Env,
        account_id: Address,
        factors: String,
    ) -> Result<(), AuthorizationError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(AuthorizationError::NotInitialized)?;
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Factors(account_id), &factors);
        Ok(())
    }

    /// Set credit score for an account (Admin only)
    pub fn set_score(
        env: Env,
        account_id: Address,
        score: u32,
    ) -> Result<(), AuthorizationError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(AuthorizationError::NotInitialized)?;
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Score(account_id), &score);
        Ok(())
    }
}

#[cfg(test)]
mod test;
