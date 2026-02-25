use soroban_sdk::{Env, Symbol};

pub trait DomainEvent {
    fn name(&self) -> Symbol;
    fn version(&self) -> u32;
    fn source(&self) -> Symbol;
    fn timestamp(&self, env: &Env) -> u64 {
        env.ledger().timestamp()
    }
    fn payload(&self) -> Vec<soroban_sdk::Val>;
}
