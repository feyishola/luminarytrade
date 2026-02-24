#![no_std]

pub mod error;
pub mod oracle_bridge;
pub mod marketplace_types;
pub mod marketplace;
pub mod validator;
pub mod storage;
pub mod upgrade_registry;
pub mod upgrade_proxy;
pub mod migration;

pub use error::CommonError;

use soroban_sdk::{
    contract,
    contractimpl,
    Address,
    Env,
    BytesN,
    contracttype,
    symbol_short,
};

#[contracttype]
pub enum DataKey {
    Admin,
    TrustedBridge,
    AgentLevel(Address),
    AgentStake(Address),
    UsedAttestation(BytesN<32>),
}

#[contracttype]
#[derive(Clone)]
pub struct Attestation {
    pub agent: Address,
    pub new_level: u32,
    pub stake_amount: i128,
    pub attestation_hash: BytesN<32>,
}

#[contract]
pub struct EvolutionManager;

#[contractimpl]
impl EvolutionManager {
    pub fn emit_evolution_completed(
        env: Env,
        agent: Address,
        new_level: u32,
        total_stake: i128,
        attestation_hash: BytesN<32>
    ) {
        env.events().publish(
            (symbol_short!("evolve"), agent),
            (new_level, total_stake, attestation_hash)
        );
    }
}
