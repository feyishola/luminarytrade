use soroban_sdk::{
    contracttype, Address, Bytes, Env, IntoVal, String, Symbol, TryFromVal, Val, Vec,
};

use super::adapter::{DataKey, DexAdapter, DexConfig, DexError, DexRegistry, DexType, TokenPair};
use super::cache::{CacheConfig, DexDataCache};
use super::liquidity::{DepthLevel, LiquidityDepth, LiquidityMetrics, PoolInfo};
use super::trading_data::{PriceData, SlippageData, TradingData, TradingVolume};

pub struct StellarDexAdapter<'a> {
    env: &'a Env,
    config: DexConfig,
    cache: DexDataCache<'a>,
}

impl<'a> StellarDexAdapter<'a> {
    pub fn new(env: &'a Env) -> Self {
        let config = DexConfig::default();
        let cache = DexDataCache::new(env);
        Self { env, config, cache }
    }

    pub fn with_config(env: &'a Env, config: DexConfig) -> Result<Self, DexError> {
        config.validate()?;
        let cache =
            DexDataCache::with_config(env, CacheConfig::new().with_ttl(config.cache_ttl_seconds));
        Ok(Self { env, config, cache })
    }

    pub fn initialize(env: &Env) -> Result<(), DexError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(DexError::AdapterNotInitialized);
        }

        let config = DexConfig::default();
        env.storage().instance().set(&DataKey::Config, &config);

        let registry = DexRegistry::new_stellar_dex();
        env.storage().instance().set(
            &DataKey::Registry(Symbol::new(env, "stellar_dex")),
            &registry,
        );

        Ok(())
    }

    pub fn get_config(&self) -> DexConfig {
        self.env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .unwrap_or_else(|| DexConfig::default())
    }

    pub fn update_config(&mut self, config: DexConfig) -> Result<(), DexError> {
        config.validate()?;
        self.config = config.clone();
        self.env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    pub fn add_supported_pair(&mut self, pair: TokenPair) -> Result<(), DexError> {
        let mut pairs: Vec<TokenPair> = self
            .env
            .storage()
            .instance()
            .get(&DataKey::SupportedPairs)
            .unwrap_or_else(|| Vec::new(self.env));

        for existing in pairs.iter() {
            if existing.token_a == pair.token_a && existing.token_b == pair.token_b {
                return Ok(());
            }
        }

        pairs.push_back(pair);
        self.env
            .storage()
            .instance()
            .set(&DataKey::SupportedPairs, &pairs);
        Ok(())
    }

    pub fn get_supported_pairs(&self) -> Vec<TokenPair> {
        self.env
            .storage()
            .instance()
            .get(&DataKey::SupportedPairs)
            .unwrap_or_else(|| Vec::new(self.env))
    }

    pub fn fetch_pool_data(&self, pair: &TokenPair) -> Result<PoolInfo, DexError> {
        if let Ok(cached) = self.cache.get_pool_info(pair) {
            return Ok(cached);
        }

        let pool_info = self.query_stellar_dex_pool(pair)?;

        let mut cache = DexDataCache::new(self.env);
        cache.set_pool_info(pair, pool_info.clone(), "stellar_dex");

        Ok(pool_info)
    }

    fn query_stellar_dex_pool(&self, pair: &TokenPair) -> Result<PoolInfo, DexError> {
        let pool_info = PoolInfo::new(self.env, pair.clone(), 1_000_000_000, 2_500_000_000, 30);

        Ok(pool_info)
    }

    pub fn fetch_price(&self, pair: &TokenPair) -> Result<PriceData, DexError> {
        if let Ok(cached) = DexDataCache::new(self.env).get_price(pair) {
            if cached.is_fresh(self.env, self.config.cache_ttl_seconds) {
                return Ok(cached);
            }
        }

        let pool = self.fetch_pool_data(pair)?;
        let price = pool.price_a_to_b();

        let price_data = PriceData::new(self.env, pair.clone(), price, 7, "stellar_dex");

        let mut cache = DexDataCache::new(self.env);
        cache.set_price(pair, price_data.clone(), "stellar_dex");

        Ok(price_data)
    }

    pub fn calculate_output(
        &self,
        pair: &TokenPair,
        input_amount: i128,
        is_a_to_b: bool,
    ) -> Result<(i128, SlippageData), DexError> {
        let pool = self.fetch_pool_data(pair)?;

        let output = pool.output_amount(input_amount, is_a_to_b);
        let price = pool.price_a_to_b();

        let expected_output = if is_a_to_b {
            (input_amount * price) / 10_000_000_000
        } else {
            (input_amount * 10_000_000_000) / price
        };

        let price_impact = pool.impact_for_trade(input_amount, is_a_to_b);

        let slippage = SlippageData::new(
            self.env,
            pair.clone(),
            input_amount,
            expected_output,
            output,
            price_impact,
        );

        Ok((output, slippage))
    }

    pub fn get_liquidity_at_levels(
        &self,
        pair: &TokenPair,
        num_levels: u32,
    ) -> Result<LiquidityDepth, DexError> {
        let pool = self.fetch_pool_data(pair)?;

        let mut depth = LiquidityDepth::new(self.env, pair.clone());

        let mid_price = pool.price_a_to_b();

        for i in 1..=num_levels {
            let distance_bps = i * 10;

            let bid_price = mid_price * (10000 - distance_bps as i128) / 10000;
            let bid_liquidity = pool.reserve_b / (num_levels as i128);
            depth.add_level(DepthLevel::new(
                bid_price,
                bid_liquidity,
                bid_liquidity * i as i128,
                true,
                distance_bps,
            ));

            let ask_price = mid_price * (10000 + distance_bps as i128) / 10000;
            let ask_liquidity = pool.reserve_a / (num_levels as i128);
            depth.add_level(DepthLevel::new(
                ask_price,
                ask_liquidity,
                ask_liquidity * i as i128,
                false,
                distance_bps,
            ));
        }

        depth.spread_bps = 10;

        Ok(depth)
    }

    pub fn batch_fetch_pools(&self, pairs: &Vec<TokenPair>) -> Vec<Result<PoolInfo, DexError>> {
        let mut results = Vec::new(self.env);

        for pair in pairs.iter() {
            let result = self.fetch_pool_data(&pair);
            results.push_back(result);
        }

        results
    }

    pub fn estimate_gas_cost(&self, operation: &str) -> u64 {
        match operation {
            "get_pool" => 5000,
            "get_price" => 3000,
            "calculate_output" => 8000,
            "get_depth" => 12000,
            _ => 10000,
        }
    }

    pub fn check_rate_limit(&self, _caller: &Address) -> Result<(), DexError> {
        Ok(())
    }
}

impl<'a> DexAdapter for StellarDexAdapter<'a> {
    fn get_pool_info(env: &Env, pair: &TokenPair) -> Result<PoolInfo, DexError> {
        let adapter = StellarDexAdapter::new(env);
        adapter.fetch_pool_data(pair)
    }

    fn get_trading_volume(
        env: &Env,
        pair: &TokenPair,
        period_seconds: u64,
    ) -> Result<TradingVolume, DexError> {
        let pool = Self::get_pool_info(env, pair)?;

        let volume = TradingVolume::new(
            env,
            pair.clone(),
            pool.reserve_a / 10,
            pool.reserve_b / 10,
            (pool.reserve_a + pool.reserve_b) / 20,
            1000,
            period_seconds,
        );

        Ok(volume)
    }

    fn get_price(env: &Env, pair: &TokenPair) -> Result<PriceData, DexError> {
        let adapter = StellarDexAdapter::new(env);
        adapter.fetch_price(pair)
    }

    fn calculate_slippage(
        env: &Env,
        pair: &TokenPair,
        amount: i128,
    ) -> Result<SlippageData, DexError> {
        let adapter = StellarDexAdapter::new(env);
        let (_, slippage) = adapter.calculate_output(pair, amount, true)?;
        Ok(slippage)
    }

    fn get_liquidity_depth(
        env: &Env,
        pair: &TokenPair,
        levels: u32,
    ) -> Result<LiquidityDepth, DexError> {
        let adapter = StellarDexAdapter::new(env);
        adapter.get_liquidity_at_levels(pair, levels)
    }

    fn get_supported_pairs(env: &Env) -> Vec<TokenPair> {
        StellarDexAdapter::new(env).get_supported_pairs()
    }

    fn is_pair_supported(env: &Env, pair: &TokenPair) -> bool {
        let pairs = Self::get_supported_pairs(env);
        for p in pairs.iter() {
            if p.token_a == pair.token_a && p.token_b == pair.token_b {
                return true;
            }
        }
        false
    }
}

pub fn create_default_pairs(env: &Env) -> Vec<TokenPair> {
    let mut pairs = Vec::new(env);

    let native = Address::from_bytes(&Bytes::from_slice(env, b"native_token_address"));
    let usdc = Address::from_bytes(&Bytes::from_slice(env, b"usdc_token_address"));
    let xlm = Address::from_bytes(&Bytes::from_slice(env, b"xlm_token_address"));

    pairs.push_back(TokenPair::new(
        env,
        native.clone(),
        usdc.clone(),
        "XLM",
        "USDC",
    ));
    pairs.push_back(TokenPair::new(
        env,
        native.clone(),
        xlm.clone(),
        "XLM",
        "NATIVE",
    ));
    pairs.push_back(TokenPair::new(env, usdc, xlm, "USDC", "XLM"));

    pairs
}

#[contracttype]
pub enum StellarDexDataKey {
    Pool(Address, Address),
    LiquidityPool(Address),
    TradeHistory(u64),
}
