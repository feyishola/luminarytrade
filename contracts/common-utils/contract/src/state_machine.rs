//! # State Machine Framework
//!
//! Provides a robust state machine implementation for Stellar smart contracts
//! to enforce proper initialization order and state transitions.
//!
//! ## Features
//! - Generic state enum with type safety
//! - State transition validation
//! - State guards for function access control
//! - Audit logging for state changes
//! - Event emission on transitions

#![allow(unused)]

use soroban_sdk::{contracttype, Env, Address, Symbol, symbol_short};
use crate::error::{StateError, ContractError};

/// Generic state wrapper that tracks the current state of a contract
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum State<T: Clone> {
    /// Contract has not been initialized
    Uninitialized,
    /// Contract is initialized and operational
    Active(T),
    /// Contract is paused (operations restricted)
    Paused(T),
    /// Contract is in migration mode
    Migrating(T),
    /// Contract is permanently disabled
    Terminated,
}

impl<T: Clone> State<T> {
    /// Check if state is uninitialized
    pub fn is_uninitialized(&self) -> bool {
        matches!(self, State::Uninitialized)
    }

    /// Check if state is active
    pub fn is_active(&self) -> bool {
        matches!(self, State::Active(_))
    }

    /// Check if state is paused
    pub fn is_paused(&self) -> bool {
        matches!(self, State::Paused(_))
    }

    /// Check if state is migrating
    pub fn is_migrating(&self) -> bool {
        matches!(self, State::Migrating(_))
    }

    /// Check if state is terminated
    pub fn is_terminated(&self) -> bool {
        matches!(self, State::Terminated)
    }

    /// Get the inner state data if available
    pub fn get_data(&self) -> Option<&T> {
        match self {
            State::Active(data) | State::Paused(data) | State::Migrating(data) => Some(data),
            _ => None,
        }
    }

    /// Get mutable inner state data if available
    pub fn get_data_mut(&mut self) -> Option<&mut T> {
        match self {
            State::Active(data) | State::Paused(data) | State::Migrating(data) => Some(data),
            _ => None,
        }
    }
}

/// Trait for contracts that implement state machine behavior
pub trait StateMachine<T: Clone> {
    /// Get the current state of the contract
    fn get_state(env: &Env) -> State<T>;

    /// Set the state of the contract (internal use)
    fn set_state(env: &Env, state: State<T>);

    /// Validate a state transition
    fn validate_transition(from: &State<T>, to: &State<T>) -> Result<(), StateError> {
        match (from, to) {
            // Uninitialized can only transition to Active
            (State::Uninitialized, State::Active(_)) => Ok(()),
            (State::Uninitialized, _) => Err(StateError::InvalidTransition),

            // Active can transition to Paused, Migrating, or Terminated
            (State::Active(_), State::Paused(_)) => Ok(()),
            (State::Active(_), State::Migrating(_)) => Ok(()),
            (State::Active(_), State::Terminated) => Ok(()),

            // Paused can transition back to Active or to Terminated
            (State::Paused(_), State::Active(_)) => Ok(()),
            (State::Paused(_), State::Terminated) => Ok(()),

            // Migrating can transition to Active or Terminated
            (State::Migrating(_), State::Active(_)) => Ok(()),
            (State::Migrating(_), State::Terminated) => Ok(()),

            // Terminated is final
            (State::Terminated, _) => Err(StateError::ContractTerminated),

            // Same state transitions are no-ops
            (a, b) if a == b => Ok(()),

            // All other transitions are invalid
            _ => Err(StateError::InvalidTransition),
        }
    }

    /// Perform a state transition with validation
    fn transition(env: &Env, new_state: State<T>) -> Result<(), StateError> {
        let current_state = Self::get_state(env);
        
        // Validate the transition
        Self::validate_transition(&current_state, &new_state)?;

        // Emit transition event
        Self::emit_transition_event(env, &current_state, &new_state);

        // Set the new state
        Self::set_state(env, new_state);

        Ok(())
    }

    /// Emit an event for state transition
    fn emit_transition_event(env: &Env, from: &State<T>, to: &State<T>) {
        let from_name = Self::state_name(from);
        let to_name = Self::state_name(to);
        
        env.events().publish(
            (symbol_short!("state_tx"), from_name),
            (to_name, env.ledger().timestamp()),
        );
    }

    /// Get a symbolic name for a state (for events)
    fn state_name(state: &State<T>) -> Symbol {
        match state {
            State::Uninitialized => symbol_short!("uninit"),
            State::Active(_) => symbol_short!("active"),
            State::Paused(_) => symbol_short!("paused"),
            State::Migrating(_) => symbol_short!("migrating"),
            State::Terminated => symbol_short!("term"),
        }
    }

    /// Require that the contract is in a specific state
    fn require_state(env: &Env, expected: &State<T>) -> Result<(), StateError> {
        let current = Self::get_state(env);
        if &current == expected {
            Ok(())
        } else {
            Err(StateError::InvalidState)
        }
    }

    /// Require that the contract is initialized (any state except Uninitialized)
    fn require_initialized(env: &Env) -> Result<(), StateError> {
        let current = Self::get_state(env);
        if current.is_uninitialized() {
            Err(StateError::NotInitialized)
        } else {
            Ok(())
        }
    }

    /// Require that the contract is active
    fn require_active(env: &Env) -> Result<(), StateError> {
        let current = Self::get_state(env);
        if current.is_active() {
            Ok(())
        } else if current.is_uninitialized() {
            Err(StateError::NotInitialized)
        } else if current.is_paused() {
            Err(StateError::ContractPaused)
        } else if current.is_terminated() {
            Err(StateError::ContractTerminated)
        } else {
            Err(StateError::InvalidState)
        }
    }

    /// Require that the contract is not terminated
    fn require_not_terminated(env: &Env) -> Result<(), StateError> {
        let current = Self::get_state(env);
        if current.is_terminated() {
            Err(StateError::ContractTerminated)
        } else {
            Ok(())
        }
    }
}

/// State guard macro - ensures function is only called in specific states
#[macro_export]
macro_rules! state_guard {
    ($contract:ty, $env:expr, active) => {
        <$contract as StateMachine<_>>::require_active($env)?
    };
    ($contract:ty, $env:expr, initialized) => {
        <$contract as StateMachine<_>>::require_initialized($env)?
    };
    ($contract:ty, $env:expr, not_terminated) => {
        <$contract as StateMachine<_>>::require_not_terminated($env)?
    };
}

/// Transition guard macro - validates and performs state transition
#[macro_export]
macro_rules! transition_to {
    ($contract:ty, $env:expr, $new_state:expr) => {
        <$contract as StateMachine<_>>::transition($env, $new_state)?
    };
}

/// Contract-specific state data structures

/// State data for fraud detection contract
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FraudDetectState {
    pub admin: Address,
    pub acl_contract: Address,
    pub total_reports: u64,
}

/// State data for risk evaluation contract
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RiskEvalState {
    pub bridge_pubkey: soroban_sdk::BytesN<32>,
    pub acl_contract: Address,
    pub total_evaluations: u64,
}

/// State data for credit score contract
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CreditScoreState {
    pub admin: Address,
    pub total_scores: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[derive(Clone, Debug, PartialEq)]
    struct TestState {
        value: u32,
    }

    #[test]
    fn test_state_transitions() {
        let uninit: State<TestState> = State::Uninitialized;
        let active = State::Active(TestState { value: 1 });
        let paused = State::Paused(TestState { value: 1 });
        let migrating = State::Migrating(TestState { value: 1 });
        let terminated = State::Terminated;

        // Valid transitions
        assert!(validate_test_transition(&uninit, &active).is_ok());
        assert!(validate_test_transition(&active, &paused).is_ok());
        assert!(validate_test_transition(&active, &migrating).is_ok());
        assert!(validate_test_transition(&active, &terminated).is_ok());
        assert!(validate_test_transition(&paused, &active).is_ok());
        assert!(validate_test_transition(&paused, &terminated).is_ok());
        assert!(validate_test_transition(&migrating, &active).is_ok());
        assert!(validate_test_transition(&migrating, &terminated).is_ok());

        // Invalid transitions
        assert!(validate_test_transition(&uninit, &paused).is_err());
        assert!(validate_test_transition(&uninit, &terminated).is_err());
        assert!(validate_test_transition(&terminated, &active).is_err());
        assert!(validate_test_transition(&paused, &migrating).is_err());
    }

    fn validate_test_transition(from: &State<TestState>, to: &State<TestState>) -> Result<(), StateError> {
        struct TestContract;
        impl StateMachine<TestState> for TestContract {
            fn get_state(_env: &Env) -> State<TestState> {
                State::Uninitialized
            }
            fn set_state(_env: &Env, _state: State<TestState>) {}
        }
        TestContract::validate_transition(from, to)
    }

    #[test]
    fn test_state_checks() {
        let uninit: State<TestState> = State::Uninitialized;
        let active = State::Active(TestState { value: 1 });
        let paused = State::Paused(TestState { value: 2 });
        let terminated = State::Terminated;

        assert!(uninit.is_uninitialized());
        assert!(!uninit.is_active());
        assert!(uninit.get_data().is_none());

        assert!(active.is_active());
        assert!(!active.is_paused());
        assert_eq!(active.get_data().unwrap().value, 1);

        assert!(paused.is_paused());
        assert!(!paused.is_active());
        assert_eq!(paused.get_data().unwrap().value, 2);

        assert!(terminated.is_terminated());
        assert!(terminated.get_data().is_none());
    }
}
