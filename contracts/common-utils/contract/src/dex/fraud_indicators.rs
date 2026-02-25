use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};

use super::adapter::TokenPair;
use super::trading_data::{TradingData, TradingVolume};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FraudIndicator {
    pub indicator_type: IndicatorType,
    pub severity: Severity,
    pub confidence: u32,
    pub description: Symbol,
    pub detected_at: u64,
    pub evidence: Vec<Evidence>,
    pub score_impact: i32,
}

impl FraudIndicator {
    pub fn new(
        env: &Env,
        indicator_type: IndicatorType,
        severity: Severity,
        description: &str,
    ) -> Self {
        Self {
            indicator_type,
            severity,
            confidence: 0,
            description: Symbol::new(env, description),
            detected_at: env.ledger().timestamp(),
            evidence: Vec::new(env),
            score_impact: 0,
        }
    }

    pub fn with_confidence(mut self, confidence: u32) -> Self {
        self.confidence = confidence.clamp(0, 100);
        self
    }

    pub fn with_impact(mut self, impact: i32) -> Self {
        self.score_impact = impact;
        self
    }

    pub fn add_evidence(&mut self, evidence: Evidence) {
        self.evidence.push_back(evidence);
    }

    pub fn risk_score(&self) -> u32 {
        let severity_multiplier = match self.severity {
            Severity::Low => 1,
            Severity::Medium => 2,
            Severity::High => 3,
            Severity::Critical => 5,
        };

        (self.confidence as u32 * severity_multiplier) / 5
    }
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IndicatorType {
    WashTrading,
    Frontrunning,
    Spoofing,
    Layering,
    MomentumIgnition,
    PumpAndDump,
    QuoteStuffing,
    CrossMarketManipulation,
    UnusualVolume,
    PriceAnomaly,
    LiquidityManipulation,
    CircularTrading,
}

impl IndicatorType {
    pub fn description(&self) -> &'static str {
        match self {
            IndicatorType::WashTrading => "Potential wash trading detected",
            IndicatorType::Frontrunning => "Possible frontrunning activity",
            IndicatorType::Spoofing => "Order spoofing detected",
            IndicatorType::Layering => "Layering manipulation detected",
            IndicatorType::MomentumIgnition => "Artificial momentum creation",
            IndicatorType::PumpAndDump => "Pump and dump pattern detected",
            IndicatorType::QuoteStuffing => "Quote stuffing activity detected",
            IndicatorType::CrossMarketManipulation => "Cross-market manipulation detected",
            IndicatorType::UnusualVolume => "Unusual trading volume detected",
            IndicatorType::PriceAnomaly => "Price anomaly detected",
            IndicatorType::LiquidityManipulation => "Liquidity manipulation detected",
            IndicatorType::CircularTrading => "Circular trading pattern detected",
        }
    }
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    pub fn score_penalty(&self) -> i32 {
        match self {
            Severity::Low => -10,
            Severity::Medium => -30,
            Severity::High => -60,
            Severity::Critical => -100,
        }
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Evidence {
    pub evidence_type: Symbol,
    pub value: i128,
    pub threshold: i128,
    pub timestamp: u64,
    pub details: Symbol,
}

impl Evidence {
    pub fn new(
        env: &Env,
        evidence_type: &str,
        value: i128,
        threshold: i128,
        details: &str,
    ) -> Self {
        Self {
            evidence_type: Symbol::new(env, evidence_type),
            value,
            threshold,
            timestamp: env.ledger().timestamp(),
            details: Symbol::new(env, details),
        }
    }

    pub fn exceeds_threshold(&self) -> bool {
        self.value > self.threshold
    }

    pub fn threshold_ratio(&self) -> i128 {
        if self.threshold == 0 {
            return 0;
        }
        (self.value * 100) / self.threshold
    }
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct TradingPattern {
    pub pattern_type: PatternType,
    pub start_time: u64,
    pub end_time: u64,
    pub trade_count: u64,
    pub volume_total: i128,
    pub volume_ratio: i128,
    pub participant_count: u32,
    pub confidence: u32,
    pub is_suspicious: bool,
}

impl TradingPattern {
    pub fn new(env: &Env, pattern_type: PatternType) -> Self {
        Self {
            pattern_type,
            start_time: 0,
            end_time: env.ledger().timestamp(),
            trade_count: 0,
            volume_total: 0,
            volume_ratio: 0,
            participant_count: 0,
            confidence: 0,
            is_suspicious: false,
        }
    }

    pub fn with_period(mut self, start: u64, end: u64) -> Self {
        self.start_time = start;
        self.end_time = end;
        self
    }

    pub fn with_stats(mut self, trades: u64, volume: i128, ratio: i128) -> Self {
        self.trade_count = trades;
        self.volume_total = volume;
        self.volume_ratio = ratio;
        self
    }

    pub fn mark_suspicious(&mut self, confidence: u32) {
        self.is_suspicious = true;
        self.confidence = confidence;
    }

    pub fn duration_seconds(&self) -> u64 {
        self.end_time.saturating_sub(self.start_time)
    }

    pub fn trades_per_second(&self) -> f64 {
        let duration = self.duration_seconds();
        if duration == 0 {
            return 0.0;
        }
        self.trade_count as f64 / duration as f64
    }
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PatternType {
    HighFrequencySequence,
    RoundTripSequence,
    CrossMarketArbitrage,
    VolumeSpike,
    PriceSpike,
    LiquidityDrain,
    AccumulationPattern,
    DistributionPattern,
    ConsolidationBreakout,
    MomentumReversal,
}

pub struct PatternDetector<'a> {
    env: &'a Env,
    thresholds: DetectionThresholds,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DetectionThresholds {
    pub wash_trade_volume_ratio: i128,
    pub frontrun_time_window_ms: u64,
    pub spoof_order_cancel_rate: u32,
    pub unusual_volume_multiplier: i128,
    pub price_deviation_bps: u32,
    pub min_confidence_for_alert: u32,
}

impl Default for DetectionThresholds {
    fn default() -> Self {
        Self {
            wash_trade_volume_ratio: 500,
            frontrun_time_window_ms: 1000,
            spoof_order_cancel_rate: 90,
            unusual_volume_multiplier: 500,
            price_deviation_bps: 500,
            min_confidence_for_alert: 60,
        }
    }
}

impl DetectionThresholds {
    pub fn new() -> Self {
        Self::default()
    }
}

impl<'a> PatternDetector<'a> {
    pub fn new(env: &'a Env) -> Self {
        Self {
            env,
            thresholds: DetectionThresholds::new(),
        }
    }

    pub fn with_thresholds(env: &'a Env, thresholds: DetectionThresholds) -> Self {
        Self { env, thresholds }
    }

    pub fn analyze(&self, trading_data: &TradingData) -> Vec<FraudIndicator> {
        let mut indicators = Vec::new(self.env);

        if let Some(indicator) = self.detect_wash_trading(trading_data) {
            indicators.push_back(indicator);
        }

        if let Some(indicator) = self.detect_unusual_volume(trading_data) {
            indicators.push_back(indicator);
        }

        if let Some(indicator) = self.detect_price_anomaly(trading_data) {
            indicators.push_back(indicator);
        }

        indicators
    }

    fn detect_wash_trading(&self, data: &TradingData) -> Option<FraudIndicator> {
        let volume_ratio = if data.volume.avg_trade_size > 0 {
            (data.volume.volume_usd * 100) / data.volume.avg_trade_size
        } else {
            0
        };

        if volume_ratio > self.thresholds.wash_trade_volume_ratio {
            let mut indicator = FraudIndicator::new(
                self.env,
                IndicatorType::WashTrading,
                Severity::High,
                IndicatorType::WashTrading.description(),
            );

            indicator.add_evidence(Evidence::new(
                self.env,
                "volume_ratio",
                volume_ratio,
                self.thresholds.wash_trade_volume_ratio,
                "high_volume_concentration",
            ));

            let confidence = ((volume_ratio - self.thresholds.wash_trade_volume_ratio) * 100)
                / self.thresholds.wash_trade_volume_ratio;
            indicator = indicator.with_confidence(confidence.clamp(0, 100) as u32);
            indicator = indicator.with_impact(Severity::High.score_penalty());

            return Some(indicator);
        }

        None
    }

    fn detect_unusual_volume(&self, data: &TradingData) -> Option<FraudIndicator> {
        let expected_volume = data.volume.volume_usd / self.thresholds.unusual_volume_multiplier;

        if data.volume.volume_usd > expected_volume * self.thresholds.unusual_volume_multiplier {
            let mut indicator = FraudIndicator::new(
                self.env,
                IndicatorType::UnusualVolume,
                Severity::Medium,
                IndicatorType::UnusualVolume.description(),
            );

            indicator.add_evidence(Evidence::new(
                self.env,
                "volume_spike",
                data.volume.volume_usd,
                expected_volume * self.thresholds.unusual_volume_multiplier,
                "abnormal_volume",
            ));

            indicator = indicator.with_confidence(70);
            indicator = indicator.with_impact(Severity::Medium.score_penalty());

            return Some(indicator);
        }

        None
    }

    fn detect_price_anomaly(&self, data: &TradingData) -> Option<FraudIndicator> {
        if data.volatility_bps > self.thresholds.price_deviation_bps {
            let mut indicator = FraudIndicator::new(
                self.env,
                IndicatorType::PriceAnomaly,
                Severity::Medium,
                IndicatorType::PriceAnomaly.description(),
            );

            indicator.add_evidence(Evidence::new(
                self.env,
                "volatility",
                data.volatility_bps as i128,
                self.thresholds.price_deviation_bps as i128,
                "high_volatility",
            ));

            indicator = indicator.with_confidence(65);
            indicator = indicator.with_impact(Severity::Medium.score_penalty());

            return Some(indicator);
        }

        None
    }

    pub fn detect_patterns(&self, trading_data: &TradingData) -> Vec<TradingPattern> {
        let mut patterns = Vec::new(self.env);

        let mut hf_pattern = TradingPattern::new(self.env, PatternType::HighFrequencySequence);
        if trading_data.volume.trade_count > 100 {
            hf_pattern.mark_suspicious(60);
        }
        patterns.push_back(hf_pattern);

        let volume_pattern = TradingPattern::new(self.env, PatternType::VolumeSpike);
        patterns.push_back(volume_pattern);

        patterns
    }

    pub fn overall_risk(&self, indicators: &Vec<FraudIndicator>) -> OverallRisk {
        if indicators.is_empty() {
            return OverallRisk {
                risk_level: RiskLevel::Low,
                total_score_impact: 0,
                critical_count: 0,
                high_count: 0,
                medium_count: 0,
                low_count: 0,
            };
        }

        let mut critical = 0u32;
        let mut high = 0u32;
        let mut medium = 0u32;
        let mut low = 0u32;
        let mut total_impact = 0i32;

        for indicator in indicators.iter() {
            match indicator.severity {
                Severity::Critical => critical += 1,
                Severity::High => high += 1,
                Severity::Medium => medium += 1,
                Severity::Low => low += 1,
            }
            total_impact += indicator.score_impact;
        }

        let risk_level = if critical > 0 || high > 2 {
            RiskLevel::Critical
        } else if high > 0 || medium > 3 {
            RiskLevel::High
        } else if medium > 0 || low > 5 {
            RiskLevel::Medium
        } else {
            RiskLevel::Low
        };

        OverallRisk {
            risk_level,
            total_score_impact: total_impact,
            critical_count: critical,
            high_count: high,
            medium_count: medium,
            low_count: low,
        }
    }
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct OverallRisk {
    pub risk_level: RiskLevel,
    pub total_score_impact: i32,
    pub critical_count: u32,
    pub high_count: u32,
    pub medium_count: u32,
    pub low_count: u32,
}

impl OverallRisk {
    pub fn is_acceptable(&self) -> bool {
        matches!(self.risk_level, RiskLevel::Low | RiskLevel::Medium)
    }

    pub fn requires_review(&self) -> bool {
        matches!(self.risk_level, RiskLevel::High | RiskLevel::Critical)
    }
}

#[contracttype]
pub enum DataKey {
    FraudIndicators(Address),
    PatternHistory(TokenPair, u64),
    DetectionThresholds,
}
