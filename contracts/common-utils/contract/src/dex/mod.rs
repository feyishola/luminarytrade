#![no_std]

pub mod adapter;
pub mod stellar_dex;
pub mod trading_data;
pub mod liquidity;
pub mod cache;
pub mod scoring_signals;
pub mod fraud_indicators;

pub use adapter::{DexAdapter, DexConfig, DexError, TokenPair};
pub use stellar_dex::StellarDexAdapter;
pub use trading_data::{TradingData, TradingVolume, PriceData, SlippageData};
pub use liquidity::{LiquidityMetrics, LiquidityDepth, PoolInfo};
pub use cache::{DexDataCache, CacheEntry, CacheConfig};
pub use scoring_signals::{ScoringSignal, SignalWeight, SignalAggregator};
pub use fraud_indicators::{FraudIndicator, TradingPattern, PatternDetector};
