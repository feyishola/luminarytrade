#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

#[test]
fn test_token_pair_creation() {
    let env = Env::default();
    let token_a = Address::generate(&env);
    let token_b = Address::generate(&env);

    let pair = TokenPair::new(&env, token_a.clone(), token_b.clone(), "XLM", "USDC");

    assert!(pair.contains(&token_a));
    assert!(pair.contains(&token_b));
    assert_eq!(pair.symbol_a, Symbol::new(&env, "XLM"));
    assert_eq!(pair.symbol_b, Symbol::new(&env, "USDC"));
}

#[test]
fn test_token_pair_other_token() {
    let env = Env::default();
    let token_a = Address::generate(&env);
    let token_b = Address::generate(&env);

    let pair = TokenPair::new(&env, token_a.clone(), token_b.clone(), "XLM", "USDC");

    assert_eq!(pair.other_token(&token_a), Some(token_b.clone()));
    assert_eq!(pair.other_token(&token_b), Some(token_a.clone()));
}

#[test]
fn test_dex_config_default() {
    let config = DexConfig::default();

    assert_eq!(config.max_slippage_bps, 500);
    assert_eq!(config.min_liquidity, 1_000_000);
    assert_eq!(config.cache_ttl_seconds, 300);
    assert_eq!(config.max_price_deviation_bps, 1000);
    assert_eq!(config.batch_size, 10);
    assert_eq!(config.rate_limit_per_minute, 60);
}

#[test]
fn test_dex_config_validation() {
    let config = DexConfig::default();
    assert!(config.validate().is_ok());

    let mut invalid_config = DexConfig::default();
    invalid_config.max_slippage_bps = 15000;
    assert!(invalid_config.validate().is_err());

    let mut invalid_config2 = DexConfig::default();
    invalid_config2.cache_ttl_seconds = 0;
    assert!(invalid_config2.validate().is_err());
}

#[test]
fn test_dex_registry_creation() {
    let stellar_dex = DexRegistry::new_stellar_dex();
    assert!(matches!(stellar_dex.dex_type, DexType::StellarDex));
    assert!(stellar_dex.is_active);
    assert!(stellar_dex.adapter_address.is_none());

    let env = Env::default();
    let adapter_address = Address::generate(&env);
    let external_dex = DexRegistry::new_external_dex(adapter_address.clone());
    assert!(matches!(external_dex.dex_type, DexType::ExternalDex));
    assert!(external_dex.is_active);
    assert_eq!(external_dex.adapter_address, Some(adapter_address));
}

#[test]
fn test_dex_error_codes() {
    assert_eq!(DexError::PoolNotFound as u32, 2001);
    assert_eq!(DexError::InsufficientLiquidity as u32, 2002);
    assert_eq!(DexError::InvalidTokenPair as u32, 2003);
    assert_eq!(DexError::CacheExpired as u32, 2008);
}
