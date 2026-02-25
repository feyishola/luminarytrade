use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct TradingVolume {
    pub pair: super::adapter::TokenPair,
    pub volume_a: i128,
    pub volume_b: i128,
    pub volume_usd: i128,
    pub trade_count: u64,
    pub period_seconds: u64,
    pub timestamp: u64,
    pub avg_trade_size: i128,
}

impl TradingVolume {
    pub fn new(
        env: &Env,
        pair: super::adapter::TokenPair,
        volume_a: i128,
        volume_b: i128,
        volume_usd: i128,
        trade_count: u64,
        period_seconds: u64,
    ) -> Self {
        let avg_trade_size = if trade_count > 0 {
            volume_usd / trade_count as i128
        } else {
            0
        };

        Self {
            pair,
            volume_a,
            volume_b,
            volume_usd,
            trade_count,
            period_seconds,
            timestamp: env.ledger().timestamp(),
            avg_trade_size,
        }
    }

    pub fn volume_per_second(&self) -> i128 {
        if self.period_seconds == 0 {
            return 0;
        }
        self.volume_usd / self.period_seconds as i128
    }

    pub fn trades_per_second(&self) -> f64 {
        if self.period_seconds == 0 {
            return 0.0;
        }
        self.trade_count as f64 / self.period_seconds as f64
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PriceData {
    pub pair: super::adapter::TokenPair,
    pub price: i128,
    pub price_decimals: u32,
    pub timestamp: u64,
    pub source: Symbol,
    pub confidence: u32,
}

impl PriceData {
    pub fn new(
        env: &Env,
        pair: super::adapter::TokenPair,
        price: i128,
        price_decimals: u32,
        source: &str,
    ) -> Self {
        Self {
            pair,
            price,
            price_decimals,
            timestamp: env.ledger().timestamp(),
            source: Symbol::new(env, source),
            confidence: 100,
        }
    }

    pub fn adjusted_price(&self, decimals: u32) -> i128 {
        if self.price_decimals == decimals {
            return self.price;
        }

        if self.price_decimals > decimals {
            let diff = self.price_decimals - decimals;
            let divisor = 10_i128.pow(diff);
            self.price / divisor
        } else {
            let diff = decimals - self.price_decimals;
            let multiplier = 10_i128.pow(diff);
            self.price * multiplier
        }
    }

    pub fn is_fresh(&self, env: &Env, max_age_seconds: u64) -> bool {
        let now = env.ledger().timestamp();
        now.saturating_sub(self.timestamp) <= max_age_seconds
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct SlippageData {
    pub pair: super::adapter::TokenPair,
    pub trade_amount: i128,
    pub expected_output: i128,
    pub actual_output: i128,
    pub slippage_bps: u32,
    pub price_impact_bps: u32,
    pub timestamp: u64,
}

impl SlippageData {
    pub fn new(
        env: &Env,
        pair: super::adapter::TokenPair,
        trade_amount: i128,
        expected_output: i128,
        actual_output: i128,
        price_impact_bps: u32,
    ) -> Self {
        let slippage_bps = if expected_output > 0 {
            let diff = if expected_output > actual_output {
                expected_output - actual_output
            } else {
                actual_output - expected_output
            };
            ((diff * 10000) / expected_output) as u32
        } else {
            0
        };

        Self {
            pair,
            trade_amount,
            expected_output,
            actual_output,
            slippage_bps,
            price_impact_bps,
            timestamp: env.ledger().timestamp(),
        }
    }

    pub fn is_acceptable(&self, max_slippage_bps: u32) -> bool {
        self.slippage_bps <= max_slippage_bps
    }

    pub fn slippage_percentage(&self) -> f64 {
        self.slippage_bps as f64 / 100.0
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct TradingData {
    pub pair: super::adapter::TokenPair,
    pub volume: TradingVolume,
    pub price: PriceData,
    pub slippage: Option<SlippageData>,
    pub volatility_bps: u32,
    pub timestamp: u64,
}

impl TradingData {
    pub fn new(
        env: &Env,
        pair: super::adapter::TokenPair,
        volume: TradingVolume,
        price: PriceData,
    ) -> Self {
        Self {
            pair,
            volume,
            price,
            slippage: None,
            volatility_bps: 0,
            timestamp: env.ledger().timestamp(),
        }
    }

    pub fn with_slippage(mut self, slippage: SlippageData) -> Self {
        self.slippage = Some(slippage);
        self
    }

    pub fn with_volatility(mut self, volatility_bps: u32) -> Self {
        self.volatility_bps = volatility_bps;
        self
    }

    pub fn is_liquid_enough(&self, min_liquidity: i128) -> bool {
        self.volume.volume_usd >= min_liquidity
    }

    pub fn trading_activity_score(&self) -> u32 {
        let volume_score = if self.volume.volume_usd > 10_000_000 {
            100
        } else if self.volume.volume_usd > 1_000_000 {
            80
        } else if self.volume.volume_usd > 100_000 {
            60
        } else if self.volume.volume_usd > 10_000 {
            40
        } else {
            20
        };

        let frequency_score = if self.volume.trade_count > 1000 {
            100
        } else if self.volume.trade_count > 100 {
            80
        } else if self.volume.trade_count > 10 {
            60
        } else {
            40
        };

        (volume_score + frequency_score) / 2
    }
}

#[contracttype]
pub enum DataKey {
    TradingData(super::adapter::TokenPair),
    VolumeHistory(super::adapter::TokenPair, u64),
    PriceHistory(super::adapter::TokenPair, u64),
}
