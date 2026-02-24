//! # TimeLock Module
//!
//! Implements delayed execution for critical contract operations.

use crate::error::TimeLockError;
use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, symbol_short, vec, Address, Bytes, Env,
    Map, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DelayLevel {
    Short = 1,
    Medium = 2,
    Long = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OperationStatus {
    Pending = 1,
    Executed = 2,
    Cancelled = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OperationCall {
    pub contract_id: Address,
    pub function: Symbol,
    pub args: Vec<soroban_sdk::Val>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScheduledOperation {
    pub calls: Vec<OperationCall>,
    pub execution_time: u64,
    pub status: OperationStatus,
    pub scheduled_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Operation(u64),
    OpCounter,
    DelayDuration(DelayLevel),
    BypassSigners,   // Vec<Address>
    BypassThreshold, // u32
}

#[contract]
pub struct TimeLock;

#[contractimpl]
impl TimeLock {
    /// Initialize the TimeLock contract
    pub fn initialize(
        env: Env,
        admin: Address,
        short_delay: u64,
        medium_delay: u64,
        long_delay: u64,
        bypass_signers: Vec<Address>,
        bypass_threshold: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::OpCounter, &0u64);

        env.storage()
            .instance()
            .set(&DataKey::DelayDuration(DelayLevel::Short), &short_delay);
        env.storage()
            .instance()
            .set(&DataKey::DelayDuration(DelayLevel::Medium), &medium_delay);
        env.storage()
            .instance()
            .set(&DataKey::DelayDuration(DelayLevel::Long), &long_delay);

        env.storage()
            .instance()
            .set(&DataKey::BypassSigners, &bypass_signers);
        env.storage()
            .instance()
            .set(&DataKey::BypassThreshold, &bypass_threshold);
    }

    /// Schedule an operation
    pub fn schedule_operation(
        env: Env,
        contract_id: Address,
        function: Symbol,
        args: Vec<soroban_sdk::Val>,
        delay_level: DelayLevel,
    ) -> u64 {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let delay: u64 = env
            .storage()
            .instance()
            .get(&DataKey::DelayDuration(delay_level.clone()))
            .unwrap();
        let scheduled_at = env.ledger().timestamp();
        let execution_time = scheduled_at.saturating_add(delay);

        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::OpCounter)
            .unwrap_or(0);
        let op_id = counter + 1;

        let operation = ScheduledOperation {
            calls: vec![
                &env,
                OperationCall {
                    contract_id,
                    function,
                    args,
                },
            ],
            execution_time,
            status: OperationStatus::Pending,
            scheduled_at,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Operation(op_id), &operation);
        env.storage().instance().set(&DataKey::OpCounter, &op_id);

        env.events().publish(
            (symbol_short!("op_sched"), op_id),
            (execution_time, delay_level),
        );

        op_id
    }

    /// Schedule a batch of operations
    pub fn schedule_batch(env: Env, calls: Vec<OperationCall>, delay_level: DelayLevel) -> u64 {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let delay: u64 = env
            .storage()
            .instance()
            .get(&DataKey::DelayDuration(delay_level.clone()))
            .unwrap();
        let scheduled_at = env.ledger().timestamp();
        let execution_time = scheduled_at.saturating_add(delay);

        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::OpCounter)
            .unwrap_or(0);
        let op_id = counter + 1;

        let operation = ScheduledOperation {
            calls,
            execution_time,
            status: OperationStatus::Pending,
            scheduled_at,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Operation(op_id), &operation);
        env.storage().instance().set(&DataKey::OpCounter, &op_id);

        env.events().publish(
            (symbol_short!("btch_sch"), op_id),
            (execution_time, delay_level),
        );

        op_id
    }

    /// Execute a scheduled operation
    pub fn execute_operation(env: Env, op_id: u64) {
        let mut operation: ScheduledOperation = env
            .storage()
            .persistent()
            .get(&DataKey::Operation(op_id))
            .unwrap_or_else(|| panic_with_error!(&env, TimeLockError::OperationNotFound));

        if operation.status != OperationStatus::Pending {
            panic_with_error!(&env, TimeLockError::AlreadyExecuted);
        }

        if env.ledger().timestamp() < operation.execution_time {
            panic_with_error!(&env, TimeLockError::NotReady);
        }

        // Mark as executed first to prevent re-entrancy
        operation.status = OperationStatus::Executed;
        env.storage()
            .persistent()
            .set(&DataKey::Operation(op_id), &operation);

        for call in operation.calls.iter() {
            env.invoke_contract::<soroban_sdk::Val>(&call.contract_id, &call.function, call.args);
        }

        env.events().publish(
            (symbol_short!("op_exec"), op_id),
            (env.ledger().timestamp(),),
        );
    }

    /// Cancel a scheduled operation
    pub fn cancel_operation(env: Env, op_id: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut operation: ScheduledOperation = env
            .storage()
            .persistent()
            .get(&DataKey::Operation(op_id))
            .unwrap_or_else(|| panic_with_error!(&env, TimeLockError::OperationNotFound));

        if operation.status != OperationStatus::Pending {
            panic_with_error!(&env, TimeLockError::AlreadyCancelled);
        }

        operation.status = OperationStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Operation(op_id), &operation);

        env.events().publish(
            (symbol_short!("op_cancel"), op_id),
            (env.ledger().timestamp(),),
        );
    }

    /// Emergency bypass with multiple signatures
    /// signatures is a list of addresses that have authorised this call
    pub fn emergency_bypass(env: Env, op_id: u64, signers: Vec<Address>) {
        // Multi-sig verification
        let bypass_signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::BypassSigners)
            .unwrap();
        let bypass_threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::BypassThreshold)
            .unwrap();

        let mut valid_signatures = 0;
        let mut seen = Map::<Address, bool>::new(&env);

        for signer in signers.iter() {
            if bypass_signers.contains(&signer) && !seen.has(signer.clone()) {
                signer.require_auth();
                seen.set(signer.clone(), true);
                valid_signatures += 1;
            }
        }

        if valid_signatures < bypass_threshold {
            panic_with_error!(&env, TimeLockError::InsufficientSignatures);
        }

        let mut operation: ScheduledOperation = env
            .storage()
            .persistent()
            .get(&DataKey::Operation(op_id))
            .unwrap_or_else(|| panic_with_error!(&env, TimeLockError::OperationNotFound));

        if operation.status != OperationStatus::Pending {
            panic_with_error!(&env, TimeLockError::AlreadyExecuted);
        }

        operation.status = OperationStatus::Executed;
        env.storage()
            .persistent()
            .set(&DataKey::Operation(op_id), &operation);

        for call in operation.calls.iter() {
            env.invoke_contract::<soroban_sdk::Val>(&call.contract_id, &call.function, call.args);
        }

        env.events().publish(
            (symbol_short!("bypass"), op_id),
            (env.ledger().timestamp(),),
        );
    }

    /// Update delay durations (Admin only)
    pub fn update_delay(env: Env, delay_level: DelayLevel, new_delay: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::DelayDuration(delay_level), &new_delay);
    }

    /// Get operation details
    pub fn get_operation(env: Env, op_id: u64) -> Option<ScheduledOperation> {
        env.storage().persistent().get(&DataKey::Operation(op_id))
    }
}
