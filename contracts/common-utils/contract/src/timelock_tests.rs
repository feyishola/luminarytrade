#![cfg(test)]

use super::error::TimeLockError;
use super::timelock::{DelayLevel, OperationCall, OperationStatus, TimeLock, TimeLockClient};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    vec, Address, Env, IntoVal, Symbol, Val,
};

#[contract]
pub struct MockContract;

#[contractimpl]
impl MockContract {
    pub fn execute(env: Env, value: u32) -> u32 {
        env.events()
            .publish((Symbol::new(&env, "mock_exec"),), (value,));
        value
    }
}

fn setup_test(env: &Env) -> (Address, Address, TimeLockClient<'static>, Address) {
    let admin = Address::generate(env);
    let bypass_signer1 = Address::generate(env);
    let bypass_signer2 = Address::generate(env);

    let timelock_id = env.register_contract(None, TimeLock);
    let client = TimeLockClient::new(env, &timelock_id);

    let mock_id = env.register_contract(None, MockContract);

    client.initialize(
        &admin,
        &3600,   // Short: 1h
        &86400,  // Medium: 1d
        &604800, // Long: 1w
        &vec![env, bypass_signer1.clone(), bypass_signer2.clone()],
        &2, // Threshold: 2
    );

    (admin, timelock_id, client, mock_id)
}

#[test]
fn test_schedule_and_execute() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, _, client, mock_id) = setup_test(&env);

    let value = 42u32;
    let args = vec![&env, value.into_val(&env)];

    let op_id = client.schedule_operation(
        &mock_id,
        &Symbol::new(&env, "execute"),
        &args,
        &DelayLevel::Short,
    );

    let op = client.get_operation(&op_id).unwrap();
    assert_eq!(op.status, OperationStatus::Pending);
    assert_eq!(op.execution_time, env.ledger().timestamp() + 3600);

    // Attempt to execute before delay
    let result = client.try_execute_operation(&op_id);
    assert!(result.is_err());

    // Jump time
    env.ledger().with_mut(|l| l.timestamp += 3601);

    client.execute_operation(&op_id);

    let op = client.get_operation(&op_id).unwrap();
    assert_eq!(op.status, OperationStatus::Executed);
}

#[test]
fn test_batch_schedule_and_execute() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, _, client, mock_id) = setup_test(&env);

    let calls = vec![
        &env,
        OperationCall {
            contract_id: mock_id.clone(),
            function: Symbol::new(&env, "execute"),
            args: vec![&env, 10u32.into_val(&env)],
        },
        OperationCall {
            contract_id: mock_id.clone(),
            function: Symbol::new(&env, "execute"),
            args: vec![&env, 20u32.into_val(&env)],
        },
    ];

    let op_id = client.schedule_batch(&calls, &DelayLevel::Medium);

    env.ledger().with_mut(|l| l.timestamp += 86401);

    client.execute_operation(&op_id);

    let op = client.get_operation(&op_id).unwrap();
    assert_eq!(op.status, OperationStatus::Executed);
    assert_eq!(op.calls.len(), 2);
}

#[test]
fn test_cancel_operation() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, _, client, mock_id) = setup_test(&env);

    let op_id = client.schedule_operation(
        &mock_id,
        &Symbol::new(&env, "execute"),
        &vec![&env, 0u32.into_val(&env)],
        &DelayLevel::Short,
    );

    client.cancel_operation(&op_id);

    let op = client.get_operation(&op_id).unwrap();
    assert_eq!(op.status, OperationStatus::Cancelled);

    // Cannot execute cancelled
    env.ledger().with_mut(|l| l.timestamp += 3601);
    let result = client.try_execute_operation(&op_id);
    assert!(result.is_err());
}

#[test]
fn test_emergency_bypass() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let bypass_signer1 = Address::generate(&env);
    let bypass_signer2 = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    let timelock_id = env.register_contract(None, TimeLock);
    let client = TimeLockClient::new(&env, &timelock_id);
    let mock_id = env.register_contract(None, MockContract);

    client.initialize(
        &admin,
        &3600,
        &86400,
        &604800,
        &vec![&env, bypass_signer1.clone(), bypass_signer2.clone()],
        &2,
    );

    let op_id = client.schedule_operation(
        &mock_id,
        &Symbol::new(&env, "execute"),
        &vec![&env, 77u32.into_val(&env)],
        &DelayLevel::Long,
    );

    // Try bypass with only 1 signer
    let result = client.try_emergency_bypass(&op_id, &vec![&env, bypass_signer1.clone()]);
    assert!(result.is_err());

    // Try bypass with unauthorized signer
    let result = client.try_emergency_bypass(
        &op_id,
        &vec![&env, bypass_signer1.clone(), unauthorized.clone()],
    );
    assert!(result.is_err());

    // Success bypass
    client.emergency_bypass(
        &op_id,
        &vec![&env, bypass_signer1.clone(), bypass_signer2.clone()],
    );

    let op = client.get_operation(&op_id).unwrap();
    assert_eq!(op.status, OperationStatus::Executed);
}
