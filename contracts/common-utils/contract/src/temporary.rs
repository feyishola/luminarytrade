use soroban_sdk::{Env, Val};

use super::{IStorageKey, StorageRepository};

/// Repository backed by **temporary storage**.
///
/// Temporary storage is discarded at the end of the transaction. Use it for
/// scratch data, reentrancy guards, or values that must not persist.
///
/// # When to use
/// - Reentrancy locks.
/// - Intermediate computation results within a multi-step transaction.
/// - Any value that must be wiped after the invocation completes.
///
/// # Note on TTL
/// `extend_ttl` is a no-op for temporary storage because temporary entries
/// are always cleaned up by the ledger at the end of the transaction.
///
/// # Example
/// ```rust
/// let repo = TemporaryStorageRepository::new(env.clone());
/// repo.set(&DataKey::ReentrancyGuard, &true);
/// // ... do work ...
/// repo.remove(&DataKey::ReentrancyGuard);
/// ```
#[derive(Clone)]
pub struct TemporaryStorageRepository {
    env: Env,
}

impl TemporaryStorageRepository {
    pub fn new(env: Env) -> Self {
        Self { env }
    }
}

impl<K> StorageRepository<K> for TemporaryStorageRepository
where
    K: IStorageKey,
{
    fn set<V>(&self, key: &K, value: &V)
    where
        V: soroban_sdk::IntoVal<Env, Val>,
    {
        crate::storage_log!(&self.env, "temporary::set", key);
        self.env.storage().temporary().set(key, value);
    }

    fn get<V>(&self, key: &K) -> Option<V>
    where
        V: soroban_sdk::TryFromVal<Env, Val>,
    {
        crate::storage_log!(&self.env, "temporary::get", key);
        self.env.storage().temporary().get(key)
    }

    fn remove(&self, key: &K) {
        crate::storage_log!(&self.env, "temporary::remove", key);
        self.env.storage().temporary().remove(key);
    }

    fn has(&self, key: &K) -> bool {
        self.env.storage().temporary().has(key)
    }

    fn extend_ttl(&self, key: &K, threshold: u32, extend_to: u32) {
        self.env
            .storage()
            .temporary()
            .extend_ttl(key, threshold, extend_to);
    }
}