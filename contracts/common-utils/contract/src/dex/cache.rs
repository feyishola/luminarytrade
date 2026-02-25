use soroban_sdk::{contracttype, Bytes, Env, Symbol, Vec};

use super::adapter::{DexError, TokenPair};
use super::liquidity::{LiquidityDepth, LiquidityMetrics, PoolInfo};
use super::trading_data::{PriceData, SlippageData, TradingData, TradingVolume};

#[contracttype]
#[derive(Clone, Debug)]
pub struct CacheConfig {
    pub default_ttl_seconds: u64,
    pub max_entries: u32,
    pub stale_while_revalidate_seconds: u64,
    pub cleanup_interval_seconds: u64,
    pub enable_compression: bool,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            default_ttl_seconds: 300,
            max_entries: 100,
            stale_while_revalidate_seconds: 60,
            cleanup_interval_seconds: 3600,
            enable_compression: true,
        }
    }
}

impl CacheConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_ttl(mut self, ttl: u64) -> Self {
        self.default_ttl_seconds = ttl;
        self
    }

    pub fn with_max_entries(mut self, max: u32) -> Self {
        self.max_entries = max;
        self
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CacheEntry<T> {
    pub data: T,
    pub cached_at: u64,
    pub expires_at: u64,
    pub access_count: u32,
    pub last_accessed: u64,
    pub is_stale: bool,
    pub source: Symbol,
}

impl<T: Clone> CacheEntry<T> {
    pub fn new(env: &Env, data: T, ttl_seconds: u64, source: &str) -> Self {
        let now = env.ledger().timestamp();
        Self {
            data,
            cached_at: now,
            expires_at: now + ttl_seconds,
            access_count: 0,
            last_accessed: now,
            is_stale: false,
            source: Symbol::new(env, source),
        }
    }

    pub fn is_expired(&self, env: &Env) -> bool {
        env.ledger().timestamp() > self.expires_at
    }

    pub fn is_stale(&self, env: &Env, stale_threshold: u64) -> bool {
        let now = env.ledger().timestamp();
        now.saturating_sub(self.cached_at) > stale_threshold
    }

    pub fn touch(&mut self, env: &Env) {
        self.access_count += 1;
        self.last_accessed = env.ledger().timestamp();
    }

    pub fn age_seconds(&self, env: &Env) -> u64 {
        env.ledger().timestamp().saturating_sub(self.cached_at)
    }

    pub fn ttl_remaining(&self, env: &Env) -> u64 {
        self.expires_at.saturating_sub(env.ledger().timestamp())
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub stale_served: u64,
    pub total_entries: u32,
    pub memory_usage_bytes: u64,
    pub last_cleanup: u64,
}

impl CacheStats {
    pub fn new(env: &Env) -> Self {
        Self {
            hits: 0,
            misses: 0,
            evictions: 0,
            stale_served: 0,
            total_entries: 0,
            memory_usage_bytes: 0,
            last_cleanup: env.ledger().timestamp(),
        }
    }

    pub fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            return 0.0;
        }
        self.hits as f64 / total as f64
    }

    pub fn record_hit(&mut self) {
        self.hits += 1;
    }

    pub fn record_miss(&mut self) {
        self.misses += 1;
    }

    pub fn record_eviction(&mut self) {
        self.evictions += 1;
    }

    pub fn record_stale_served(&mut self) {
        self.stale_served += 1;
    }
}

#[contracttype]
pub enum DataKey {
    TradingDataCache(TokenPair),
    VolumeCache(TokenPair),
    PriceCache(TokenPair),
    PoolInfoCache(TokenPair),
    LiquidityMetricsCache(TokenPair),
    LiquidityDepthCache(TokenPair),
    CacheStats,
    CacheConfig,
    LastCleanup,
}

pub struct DexDataCache<'a> {
    env: &'a Env,
    config: CacheConfig,
    stats: CacheStats,
}

impl<'a> DexDataCache<'a> {
    pub fn new(env: &'a Env) -> Self {
        let config = env
            .storage()
            .instance()
            .get(&DataKey::CacheConfig)
            .unwrap_or_else(|| CacheConfig::new());
        let stats = env
            .storage()
            .instance()
            .get(&DataKey::CacheStats)
            .unwrap_or_else(|| CacheStats::new(env));

        Self { env, config, stats }
    }

    pub fn with_config(env: &'a Env, config: CacheConfig) -> Self {
        let stats = env
            .storage()
            .instance()
            .get(&DataKey::CacheStats)
            .unwrap_or_else(|| CacheStats::new(env));
        env.storage().instance().set(&DataKey::CacheConfig, &config);

        Self { env, config, stats }
    }

    pub fn get_trading_data(&mut self, pair: &TokenPair) -> Result<TradingData, DexError> {
        let key = DataKey::TradingDataCache(pair.clone());

        if let Some(entry) = self
            .env
            .storage()
            .temporary()
            .get::<_, CacheEntry<TradingData>>(&key)
        {
            if !entry.is_expired(self.env) {
                let mut entry = entry;
                entry.touch(self.env);
                self.env.storage().temporary().set(&key, &entry);
                self.stats.record_hit();
                self.save_stats();
                return Ok(entry.data);
            }
        }

        self.stats.record_miss();
        self.save_stats();
        Err(DexError::CacheMiss)
    }

    pub fn set_trading_data(&mut self, pair: &TokenPair, data: TradingData, source: &str) {
        let key = DataKey::TradingDataCache(pair.clone());
        let entry = CacheEntry::new(self.env, data, self.config.default_ttl_seconds, source);
        self.env.storage().temporary().set(&key, &entry);
        self.stats.total_entries += 1;
        self.save_stats();
    }

    pub fn get_pool_info(&mut self, pair: &TokenPair) -> Result<PoolInfo, DexError> {
        let key = DataKey::PoolInfoCache(pair.clone());

        if let Some(entry) = self
            .env
            .storage()
            .temporary()
            .get::<_, CacheEntry<PoolInfo>>(&key)
        {
            if !entry.is_expired(self.env) {
                let mut entry = entry;
                entry.touch(self.env);
                self.env.storage().temporary().set(&key, &entry);
                self.stats.record_hit();
                self.save_stats();
                return Ok(entry.data);
            }
        }

        self.stats.record_miss();
        self.save_stats();
        Err(DexError::CacheMiss)
    }

    pub fn set_pool_info(&mut self, pair: &TokenPair, data: PoolInfo, source: &str) {
        let key = DataKey::PoolInfoCache(pair.clone());
        let entry = CacheEntry::new(self.env, data, self.config.default_ttl_seconds, source);
        self.env.storage().temporary().set(&key, &entry);
        self.stats.total_entries += 1;
        self.save_stats();
    }

    pub fn get_liquidity_metrics(
        &mut self,
        pair: &TokenPair,
    ) -> Result<LiquidityMetrics, DexError> {
        let key = DataKey::LiquidityMetricsCache(pair.clone());

        if let Some(entry) = self
            .env
            .storage()
            .temporary()
            .get::<_, CacheEntry<LiquidityMetrics>>(&key)
        {
            if !entry.is_expired(self.env) {
                let mut entry = entry;
                entry.touch(self.env);
                self.env.storage().temporary().set(&key, &entry);
                self.stats.record_hit();
                self.save_stats();
                return Ok(entry.data);
            }
        }

        self.stats.record_miss();
        self.save_stats();
        Err(DexError::CacheMiss)
    }

    pub fn set_liquidity_metrics(
        &mut self,
        pair: &TokenPair,
        data: LiquidityMetrics,
        source: &str,
    ) {
        let key = DataKey::LiquidityMetricsCache(pair.clone());
        let entry = CacheEntry::new(self.env, data, self.config.default_ttl_seconds, source);
        self.env.storage().temporary().set(&key, &entry);
        self.stats.total_entries += 1;
        self.save_stats();
    }

    pub fn get_price(&mut self, pair: &TokenPair) -> Result<PriceData, DexError> {
        let key = DataKey::PriceCache(pair.clone());

        if let Some(entry) = self
            .env
            .storage()
            .temporary()
            .get::<_, CacheEntry<PriceData>>(&key)
        {
            if !entry.is_expired(self.env) {
                let mut entry = entry;
                entry.touch(self.env);
                self.env.storage().temporary().set(&key, &entry);
                self.stats.record_hit();
                self.save_stats();
                return Ok(entry.data);
            }
        }

        self.stats.record_miss();
        self.save_stats();
        Err(DexError::CacheMiss)
    }

    pub fn set_price(&mut self, pair: &TokenPair, data: PriceData, source: &str) {
        let key = DataKey::PriceCache(pair.clone());
        let entry = CacheEntry::new(self.env, data, self.config.default_ttl_seconds, source);
        self.env.storage().temporary().set(&key, &entry);
        self.stats.total_entries += 1;
        self.save_stats();
    }

    pub fn invalidate(&mut self, pair: &TokenPair) {
        self.env
            .storage()
            .temporary()
            .remove(&DataKey::TradingDataCache(pair.clone()));
        self.env
            .storage()
            .temporary()
            .remove(&DataKey::VolumeCache(pair.clone()));
        self.env
            .storage()
            .temporary()
            .remove(&DataKey::PriceCache(pair.clone()));
        self.env
            .storage()
            .temporary()
            .remove(&DataKey::PoolInfoCache(pair.clone()));
        self.env
            .storage()
            .temporary()
            .remove(&DataKey::LiquidityMetricsCache(pair.clone()));
        self.env
            .storage()
            .temporary()
            .remove(&DataKey::LiquidityDepthCache(pair.clone()));
        self.stats.total_entries = self.stats.total_entries.saturating_sub(6);
        self.save_stats();
    }

    pub fn invalidate_all(&mut self) {
        let pairs: Vec<TokenPair> = self
            .env
            .storage()
            .instance()
            .get(&DataKey::TradingDataCache(TokenPair::default()))
            .unwrap_or_else(|| Vec::new(self.env));

        for pair in pairs.iter() {
            self.invalidate(&pair);
        }

        self.stats.total_entries = 0;
        self.save_stats();
    }

    pub fn cleanup_expired(&mut self) -> u32 {
        let mut cleaned = 0u32;

        let now = self.env.ledger().timestamp();
        if let Some(last_cleanup) = self
            .env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::LastCleanup)
        {
            if now.saturating_sub(last_cleanup) < self.config.cleanup_interval_seconds {
                return 0;
            }
        }

        self.env
            .storage()
            .instance()
            .set(&DataKey::LastCleanup, &now);

        cleaned
    }

    pub fn get_stats(&self) -> CacheStats {
        self.stats.clone()
    }

    fn save_stats(&self) {
        self.env
            .storage()
            .instance()
            .set(&DataKey::CacheStats, &self.stats);
    }

    pub fn is_stale(&self, pair: &TokenPair) -> bool {
        if let Some(entry) = self
            .env
            .storage()
            .temporary()
            .get::<_, CacheEntry<TradingData>>(&DataKey::TradingDataCache(pair.clone()))
        {
            return entry.is_stale(self.env, self.config.stale_while_revalidate_seconds);
        }
        true
    }

    pub fn get_or_stale(&mut self, pair: &TokenPair) -> Option<TradingData> {
        if let Some(entry) = self
            .env
            .storage()
            .temporary()
            .get::<_, CacheEntry<TradingData>>(&DataKey::TradingDataCache(pair.clone()))
        {
            if !entry.is_expired(self.env) {
                let mut entry = entry;
                entry.touch(self.env);
                self.env
                    .storage()
                    .temporary()
                    .set(&DataKey::TradingDataCache(pair.clone()), &entry);

                if entry.is_stale(self.env, self.config.stale_while_revalidate_seconds) {
                    self.stats.record_stale_served();
                }
                self.stats.record_hit();
                self.save_stats();
                return Some(entry.data);
            }
        }
        self.stats.record_miss();
        self.save_stats();
        None
    }
}
