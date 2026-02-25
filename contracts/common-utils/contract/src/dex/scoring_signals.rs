use soroban_sdk::{contracttype, Env, Symbol, Vec};

use super::adapter::TokenPair;
use super::liquidity::LiquidityMetrics;
use super::trading_data::TradingData;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ScoringSignal {
    pub signal_type: SignalType,
    pub value: i128,
    pub normalized_score: u32,
    pub weight: u32,
    pub confidence: u32,
    pub timestamp: u64,
    pub source: Symbol,
}

impl ScoringSignal {
    pub fn new(env: &Env, signal_type: SignalType, value: i128, weight: u32) -> Self {
        Self {
            signal_type,
            value,
            normalized_score: 0,
            weight,
            confidence: 100,
            timestamp: env.ledger().timestamp(),
            source: Symbol::new(env, "dex"),
        }
    }

    pub fn normalize(&mut self, min: i128, max: i128) {
        if max == min {
            self.normalized_score = 50;
            return;
        }

        let clamped = self.value.clamp(min, max);
        let normalized = ((clamped - min) * 100) / (max - min);
        self.normalized_score = normalized as u32;
    }

    pub fn weighted_score(&self) -> u32 {
        (self.normalized_score as u64 * self.weight as u64 / 100) as u32
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SignalType {
    TradingVolume,
    LiquidityDepth,
    PriceStability,
    TradeFrequency,
    SlippageTolerance,
    LiquidityConsistency,
    MarketDepth,
    PriceImpact,
    VolumeTrend,
    LiquidityTrend,
}

impl SignalType {
    pub fn name(&self) -> &'static str {
        match self {
            SignalType::TradingVolume => "trading_volume",
            SignalType::LiquidityDepth => "liquidity_depth",
            SignalType::PriceStability => "price_stability",
            SignalType::TradeFrequency => "trade_frequency",
            SignalType::SlippageTolerance => "slippage_tolerance",
            SignalType::LiquidityConsistency => "liquidity_consistency",
            SignalType::MarketDepth => "market_depth",
            SignalType::PriceImpact => "price_impact",
            SignalType::VolumeTrend => "volume_trend",
            SignalType::LiquidityTrend => "liquidity_trend",
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct SignalWeight {
    pub signal_type: SignalType,
    pub weight: u32,
    pub min_value: i128,
    pub max_value: i128,
    pub decay_factor: u32,
}

impl SignalWeight {
    pub fn new(signal_type: SignalType, weight: u32, min: i128, max: i128) -> Self {
        Self {
            signal_type,
            weight,
            min_value: min,
            max_value: max,
            decay_factor: 0,
        }
    }

    pub fn default_weights(env: &Env) -> Vec<SignalWeight> {
        let mut weights = Vec::new(env);
        weights.push_back(SignalWeight::new(
            SignalType::TradingVolume,
            25,
            0,
            100_000_000,
        ));
        weights.push_back(SignalWeight::new(
            SignalType::LiquidityDepth,
            20,
            0,
            50_000_000,
        ));
        weights.push_back(SignalWeight::new(SignalType::PriceStability, 15, 0, 10000));
        weights.push_back(SignalWeight::new(SignalType::TradeFrequency, 10, 0, 10000));
        weights.push_back(SignalWeight::new(
            SignalType::SlippageTolerance,
            15,
            0,
            5000,
        ));
        weights.push_back(SignalWeight::new(
            SignalType::LiquidityConsistency,
            15,
            0,
            10000,
        ));
        weights
    }

    pub fn with_decay(mut self, decay: u32) -> Self {
        self.decay_factor = decay;
        self
    }
}

pub struct SignalAggregator<'a> {
    env: &'a Env,
    weights: Vec<SignalWeight>,
}

impl<'a> SignalAggregator<'a> {
    pub fn new(env: &'a Env) -> Self {
        Self {
            env,
            weights: SignalWeight::default_weights(env),
        }
    }

    pub fn with_weights(env: &'a Env, weights: Vec<SignalWeight>) -> Self {
        Self { env, weights }
    }

    pub fn aggregate(
        &self,
        trading_data: &TradingData,
        liquidity: &LiquidityMetrics,
    ) -> Vec<ScoringSignal> {
        let mut signals = Vec::new(self.env);

        let mut volume_signal = ScoringSignal::new(
            self.env,
            SignalType::TradingVolume,
            trading_data.volume.volume_usd,
            self.get_weight(&SignalType::TradingVolume),
        );
        let vol_weight = self.find_weight(&SignalType::TradingVolume);
        volume_signal.normalize(vol_weight.min_value, vol_weight.max_value);
        signals.push_back(volume_signal);

        let mut depth_signal = ScoringSignal::new(
            self.env,
            SignalType::LiquidityDepth,
            liquidity.total_liquidity_usd,
            self.get_weight(&SignalType::LiquidityDepth),
        );
        let depth_weight = self.find_weight(&SignalType::LiquidityDepth);
        depth_signal.normalize(depth_weight.min_value, depth_weight.max_value);
        signals.push_back(depth_signal);

        let mut stability_signal = ScoringSignal::new(
            self.env,
            SignalType::PriceStability,
            (10000 - trading_data.volatility_bps as i128),
            self.get_weight(&SignalType::PriceStability),
        );
        let stability_weight = self.find_weight(&SignalType::PriceStability);
        stability_signal.normalize(stability_weight.min_value, stability_weight.max_value);
        signals.push_back(stability_signal);

        let mut frequency_signal = ScoringSignal::new(
            self.env,
            SignalType::TradeFrequency,
            trading_data.volume.trade_count as i128,
            self.get_weight(&SignalType::TradeFrequency),
        );
        let freq_weight = self.find_weight(&SignalType::TradeFrequency);
        frequency_signal.normalize(freq_weight.min_value, freq_weight.max_value);
        signals.push_back(frequency_signal);

        if let Some(ref slippage) = trading_data.slippage {
            let mut slippage_signal = ScoringSignal::new(
                self.env,
                SignalType::SlippageTolerance,
                (5000 - slippage.slippage_bps as i128).max(0) as i128,
                self.get_weight(&SignalType::SlippageTolerance),
            );
            let slip_weight = self.find_weight(&SignalType::SlippageTolerance);
            slippage_signal.normalize(slip_weight.min_value, slip_weight.max_value);
            signals.push_back(slippage_signal);
        }

        let mut consistency_signal = ScoringSignal::new(
            self.env,
            SignalType::LiquidityConsistency,
            (10000 + liquidity.liquidity_change_24h_bps as i128).clamp(0, 20000),
            self.get_weight(&SignalType::LiquidityConsistency),
        );
        let cons_weight = self.find_weight(&SignalType::LiquidityConsistency);
        consistency_signal.normalize(cons_weight.min_value, cons_weight.max_value);
        signals.push_back(consistency_signal);

        signals
    }

    pub fn calculate_score(&self, signals: &Vec<ScoringSignal>) -> u32 {
        if signals.is_empty() {
            return 0;
        }

        let total_weight: u32 = signals.iter().map(|s| s.weight).sum();
        if total_weight == 0 {
            return 0;
        }

        let weighted_sum: u64 = signals.iter().map(|s| s.weighted_score() as u64).sum();

        let total_weight_u64 = total_weight as u64;
        let adjusted_weight = if total_weight_u64 > 100 {
            100
        } else {
            total_weight_u64
        };

        ((weighted_sum * 100) / adjusted_weight) as u32
    }

    pub fn calculate_credit_impact(&self, base_score: u32, signals: &Vec<ScoringSignal>) -> i32 {
        let dex_score = self.calculate_score(signals);

        let deviation = if dex_score > 50 {
            (dex_score - 50) as i32
        } else {
            -((50 - dex_score) as i32)
        };

        let impact = (deviation as f64 * 0.2) as i32;

        let adjusted_base = base_score as i32 + impact;
        adjusted_base.clamp(0, 1000)
    }

    fn get_weight(&self, signal_type: &SignalType) -> u32 {
        self.find_weight(signal_type).weight
    }

    fn find_weight(&self, signal_type: &SignalType) -> &SignalWeight {
        for weight in self.weights.iter() {
            if weight.signal_type == *signal_type {
                return &weight;
            }
        }

        &self.weights.get(0).unwrap()
    }

    pub fn signal_summary(&self, signals: &Vec<ScoringSignal>) -> SignalSummary {
        let mut positive = 0u32;
        let mut negative = 0u32;
        let mut neutral = 0u32;
        let mut total_confidence = 0u64;
        let count = signals.len() as u32;

        for signal in signals.iter() {
            total_confidence += signal.confidence as u64;

            if signal.normalized_score > 66 {
                positive += 1;
            } else if signal.normalized_score < 33 {
                negative += 1;
            } else {
                neutral += 1;
            }
        }

        let avg_confidence = if count > 0 {
            (total_confidence / count as u64) as u32
        } else {
            0
        };

        SignalSummary {
            positive_count: positive,
            negative_count: negative,
            neutral_count: neutral,
            average_confidence: avg_confidence,
            overall_score: self.calculate_score(signals),
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct SignalSummary {
    pub positive_count: u32,
    pub negative_count: u32,
    pub neutral_count: u32,
    pub average_confidence: u32,
    pub overall_score: u32,
}

impl SignalSummary {
    pub fn is_healthy(&self) -> bool {
        self.overall_score >= 50 && self.negative_count <= self.positive_count
    }

    pub fn risk_level(&self) -> RiskLevel {
        match self.overall_score {
            0..=33 => RiskLevel::High,
            34..=66 => RiskLevel::Medium,
            _ => RiskLevel::Low,
        }
    }
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

#[contracttype]
pub enum DataKey {
    SignalWeights,
    SignalHistory(TokenPair, u64),
}
