use soroban_sdk::{contracterror, contracttype, Address, Bytes, Env, String, Symbol, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DexError {
    PoolNotFound = 2001,
    InsufficientLiquidity = 2002,
    InvalidTokenPair = 2003,
    PriceFetchFailed = 2004,
    VolumeFetchFailed = 2005,
    SlippageCalcFailed = 2006,
    DepthCalcFailed = 2007,
    CacheExpired = 2008,
    CacheMiss = 2009,
    InvalidConfig = 2010,
    AdapterNotInitialized = 2011,
    UnsupportedToken = 2012,
    RateLimitExceeded = 2013,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenPair {
    pub token_a: Address,
    pub token_b: Address,
    pub symbol_a: Symbol,
    pub symbol_b: Symbol,
}

impl TokenPair {
    pub fn new(
        env: &Env,
        token_a: Address,
        token_b: Address,
        symbol_a: &str,
        symbol_b: &str,
    ) -> Self {
        Self {
            token_a,
            token_b,
            symbol_a: Symbol::new(env, symbol_a),
            symbol_b: Symbol::new(env, symbol_b),
        }
    }

    pub fn contains(&self, token: &Address) -> bool {
        self.token_a == *token || self.token_b == *token
    }

    pub fn other_token(&self, token: &Address) -> Option<Address> {
        if self.token_a == *token {
            Some(self.token_b.clone())
        } else if self.token_b == *token {
            Some(self.token_a.clone())
        } else {
            None
        }
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DexConfig {
    pub max_slippage_bps: u32,
    pub min_liquidity: i128,
    pub cache_ttl_seconds: u64,
    pub max_price_deviation_bps: u32,
    pub batch_size: u32,
    pub rate_limit_per_minute: u32,
}

impl Default for DexConfig {
    fn default() -> Self {
        Self {
            max_slippage_bps: 500,
            min_liquidity: 1_000_000,
            cache_ttl_seconds: 300,
            max_price_deviation_bps: 1000,
            batch_size: 10,
            rate_limit_per_minute: 60,
        }
    }
}

impl DexConfig {
    pub fn new(env: &Env) -> Self {
        let _ = env;
        Self::default()
    }

    pub fn validate(&self) -> Result<(), DexError> {
        if self.max_slippage_bps > 10000 {
            return Err(DexError::InvalidConfig);
        }
        if self.cache_ttl_seconds == 0 {
            return Err(DexError::InvalidConfig);
        }
        if self.batch_size == 0 {
            return Err(DexError::InvalidConfig);
        }
        Ok(())
    }
}

pub trait DexAdapter {
    fn get_pool_info(env: &Env, pair: &TokenPair) -> Result<super::liquidity::PoolInfo, DexError>;

    fn get_trading_volume(
        env: &Env,
        pair: &TokenPair,
        period_seconds: u64,
    ) -> Result<super::trading_data::TradingVolume, DexError>;

    fn get_price(env: &Env, pair: &TokenPair) -> Result<super::trading_data::PriceData, DexError>;

    fn calculate_slippage(
        env: &Env,
        pair: &TokenPair,
        amount: i128,
    ) -> Result<super::trading_data::SlippageData, DexError>;

    fn get_liquidity_depth(
        env: &Env,
        pair: &TokenPair,
        levels: u32,
    ) -> Result<super::liquidity::LiquidityDepth, DexError>;

    fn get_supported_pairs(env: &Env) -> Vec<TokenPair>;

    fn is_pair_supported(env: &Env, pair: &TokenPair) -> bool;
}

#[contracttype]
#[derive(Clone, Debug)]
pub enum DexType {
    StellarDex,
    ExternalDex,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DexRegistry {
    pub dex_type: DexType,
    pub adapter_address: Option<Address>,
    pub is_active: bool,
}

impl DexRegistry {
    pub fn new_stellar_dex() -> Self {
        Self {
            dex_type: DexType::StellarDex,
            adapter_address: None,
            is_active: true,
        }
    }

    pub fn new_external_dex(adapter_address: Address) -> Self {
        Self {
            dex_type: DexType::ExternalDex,
            adapter_address: Some(adapter_address),
            is_active: true,
        }
    }
}

#[contracttype]
pub enum DataKey {
    Config,
    Registry(Symbol),
    SupportedPairs,
    LastUpdate,
}
