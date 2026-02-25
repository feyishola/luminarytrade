//! Comprehensive tests for the state machine framework

#![cfg(test)]

use super::state_machine::*;
use crate::error::StateError;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol, symbol_short};

#[derive(Clone, Debug, PartialEq)]
struct MockContractState {
    admin: Address,
    counter: u32,
}

struct MockContract;

impl StateMachine<MockContractState> for MockContract {
    fn get_state(env: &Env) -> State<MockContractState> {
        env.storage()
            .instance()
            .get(&symbol_short!("state"))
            .unwrap_or(State::Uninitialized)
    }

    fn set_state(env: &Env, state: State<MockContractState>) {
        env.storage().instance().set(&symbol_short!("state"), &state);
    }
}

#[test]
fn test_initial_state_is_uninitialized() {
    let env = Env::default();
    let state = MockContract::get_state(&env);
    assert!(state.is_uninitialized());
}

#[test]
fn test_transition_from_uninitialized_to_active() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let new_state = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    
    let result = MockContract::transition(&env, new_state.clone());
    assert!(result.is_ok());
    
    let current_state = MockContract::get_state(&env);
    assert!(current_state.is_active());
    assert_eq!(current_state.get_data().unwrap().counter, 0);
}

#[test]
fn test_invalid_transition_from_uninitialized_to_paused() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let new_state = State::Paused(MockContractState {
        admin,
        counter: 0,
    });
    
    let result = MockContract::transition(&env, new_state);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StateError::InvalidTransition);
}

#[test]
fn test_transition_from_active_to_paused() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    // First initialize to active
    let active_state = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 5,
    });
    MockContract::set_state(&env, active_state);
    
    // Then transition to paused
    let paused_state = State::Paused(MockContractState {
        admin: admin.clone(),
        counter: 5,
    });
    
    let result = MockContract::transition(&env, paused_state);
    assert!(result.is_ok());
    
    let current_state = MockContract::get_state(&env);
    assert!(current_state.is_paused());
}

#[test]
fn test_transition_from_paused_to_active() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    // Set to paused
    let paused_state = State::Paused(MockContractState {
        admin: admin.clone(),
        counter: 10,
    });
    MockContract::set_state(&env, paused_state);
    
    // Transition back to active
    let active_state = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 10,
    });
    
    let result = MockContract::transition(&env, active_state);
    assert!(result.is_ok());
    
    let current_state = MockContract::get_state(&env);
    assert!(current_state.is_active());
}

#[test]
fn test_transition_from_active_to_migrating() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let active_state = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    MockContract::set_state(&env, active_state);
    
    let migrating_state = State::Migrating(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    
    let result = MockContract::transition(&env, migrating_state);
    assert!(result.is_ok());
    
    let current_state = MockContract::get_state(&env);
    assert!(current_state.is_migrating());
}

#[test]
fn test_transition_from_migrating_to_active() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let migrating_state = State::Migrating(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    MockContract::set_state(&env, migrating_state);
    
    let active_state = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    
    let result = MockContract::transition(&env, active_state);
    assert!(result.is_ok());
}

#[test]
fn test_transition_to_terminated_from_active() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let active_state = State::Active(MockContractState {
        admin,
        counter: 0,
    });
    MockContract::set_state(&env, active_state);
    
    let result = MockContract::transition(&env, State::Terminated);
    assert!(result.is_ok());
    
    let current_state = MockContract::get_state(&env);
    assert!(current_state.is_terminated());
}

#[test]
fn test_cannot_transition_from_terminated() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    MockContract::set_state(&env, State::Terminated);
    
    let active_state = State::Active(MockContractState {
        admin,
        counter: 0,
    });
    
    let result = MockContract::transition(&env, active_state);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StateError::ContractTerminated);
}

#[test]
fn test_require_initialized_fails_when_uninitialized() {
    let env = Env::default();
    
    let result = MockContract::require_initialized(&env);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StateError::NotInitialized);
}

#[test]
fn test_require_initialized_succeeds_when_active() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let active_state = State::Active(MockContractState {
        admin,
        counter: 0,
    });
    MockContract::set_state(&env, active_state);
    
    let result = MockContract::require_initialized(&env);
    assert!(result.is_ok());
}

#[test]
fn test_require_active_fails_when_paused() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let paused_state = State::Paused(MockContractState {
        admin,
        counter: 0,
    });
    MockContract::set_state(&env, paused_state);
    
    let result = MockContract::require_active(&env);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StateError::ContractPaused);
}

#[test]
fn test_require_active_fails_when_terminated() {
    let env = Env::default();
    
    MockContract::set_state(&env, State::Terminated);
    
    let result = MockContract::require_active(&env);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StateError::ContractTerminated);
}

#[test]
fn test_require_active_succeeds_when_active() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let active_state = State::Active(MockContractState {
        admin,
        counter: 0,
    });
    MockContract::set_state(&env, active_state);
    
    let result = MockContract::require_active(&env);
    assert!(result.is_ok());
}

#[test]
fn test_require_not_terminated_fails_when_terminated() {
    let env = Env::default();
    
    MockContract::set_state(&env, State::Terminated);
    
    let result = MockContract::require_not_terminated(&env);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StateError::ContractTerminated);
}

#[test]
fn test_require_not_terminated_succeeds_when_active() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let active_state = State::Active(MockContractState {
        admin,
        counter: 0,
    });
    MockContract::set_state(&env, active_state);
    
    let result = MockContract::require_not_terminated(&env);
    assert!(result.is_ok());
}

#[test]
fn test_state_data_access() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let active_state = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 42,
    });
    MockContract::set_state(&env, active_state);
    
    let current_state = MockContract::get_state(&env);
    let data = current_state.get_data().unwrap();
    assert_eq!(data.counter, 42);
    assert_eq!(data.admin, admin);
}

#[test]
fn test_invalid_transition_from_paused_to_migrating() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let paused_state = State::Paused(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    MockContract::set_state(&env, paused_state);
    
    let migrating_state = State::Migrating(MockContractState {
        admin,
        counter: 0,
    });
    
    let result = MockContract::transition(&env, migrating_state);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), StateError::InvalidTransition);
}

#[test]
fn test_state_transition_events() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    let active_state = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    
    let result = MockContract::transition(&env, active_state);
    assert!(result.is_ok());
    
    // Events should be emitted (we can't easily verify in tests without more setup)
}

#[test]
fn test_same_state_transition_is_noop() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let active_state = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 5,
    });
    MockContract::set_state(&env, active_state.clone());
    
    // Transition to the same state
    let result = MockContract::transition(&env, active_state);
    assert!(result.is_ok());
}

#[test]
fn test_fraud_detect_state_structure() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let acl = Address::generate(&env);
    
    let fraud_state = FraudDetectState {
        admin,
        acl_contract: acl,
        total_reports: 100,
    };
    
    let state: State<FraudDetectState> = State::Active(fraud_state.clone());
    assert!(state.is_active());
    assert_eq!(state.get_data().unwrap().total_reports, 100);
}

#[test]
fn test_risk_eval_state_structure() {
    let env = Env::default();
    let acl = Address::generate(&env);
    let pubkey = soroban_sdk::BytesN::from_array(&env, &[0u8; 32]);
    
    let risk_state = RiskEvalState {
        bridge_pubkey: pubkey,
        acl_contract: acl,
        total_evaluations: 50,
    };
    
    let state: State<RiskEvalState> = State::Active(risk_state);
    assert!(state.is_active());
    assert_eq!(state.get_data().unwrap().total_evaluations, 50);
}

#[test]
fn test_credit_score_state_structure() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let credit_state = CreditScoreState {
        admin,
        total_scores: 200,
    };
    
    let state: State<CreditScoreState> = State::Active(credit_state);
    assert!(state.is_active());
    assert_eq!(state.get_data().unwrap().total_scores, 200);
}

#[test]
fn test_complete_lifecycle() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    // Start uninitialized
    assert!(MockContract::get_state(&env).is_uninitialized());
    
    // Initialize to active
    let active = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    assert!(MockContract::transition(&env, active).is_ok());
    assert!(MockContract::get_state(&env).is_active());
    
    // Pause
    let paused = State::Paused(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    assert!(MockContract::transition(&env, paused).is_ok());
    assert!(MockContract::get_state(&env).is_paused());
    
    // Resume
    let active2 = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    assert!(MockContract::transition(&env, active2).is_ok());
    assert!(MockContract::get_state(&env).is_active());
    
    // Migrate
    let migrating = State::Migrating(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    assert!(MockContract::transition(&env, migrating).is_ok());
    assert!(MockContract::get_state(&env).is_migrating());
    
    // Complete migration
    let active3 = State::Active(MockContractState {
        admin: admin.clone(),
        counter: 0,
    });
    assert!(MockContract::transition(&env, active3).is_ok());
    assert!(MockContract::get_state(&env).is_active());
    
    // Terminate
    assert!(MockContract::transition(&env, State::Terminated).is_ok());
    assert!(MockContract::get_state(&env).is_terminated());
    
    // Cannot do anything after termination
    let active4 = State::Active(MockContractState {
        admin,
        counter: 0,
    });
    assert!(MockContract::transition(&env, active4).is_err());
}
