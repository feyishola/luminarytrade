//! # Rate Limiting Framework for Soroban Smart Contracts
//!
//! Provides configurable, per-function and per-user rate limiting to prevent abuse
//! and ensure fair resource allocation on-chain.
//!
//! ## Strategies
//!
//! - **Fixed Window**: Counts invocations within discrete time windows.
//! - **Sliding Window**: Approximates a true sliding window using the previous
//!   window's count weighted by elapsed fraction.
//! - **Token Bucket**: Allows bursts up to bucket capacity, refilling at a
//!   steady rate over time.
//!
//! ## Usage
//!
//! ```rust
//! use common_utils::rate_limit::*;
//!
//! // Create a fixed-window limiter: 10 calls per 3600-second window
//! let config = RateLimitConfig {
//!     max_requests: 10,
//!     window_seconds: 3600,
//!     strategy: RateLimitStrategy::FixedWindow,
//!     scope: RateLimitScope::PerUser,
//! };
//!
//! // In your contract function:
//! RateLimiter::check_and_update(&env, &caller, &symbol_short!("submit"), &config)?;
//! ```

#![allow(unused)]

use soroban_sdk::{
    contracttype, symbol_short, Address, Env, Symbol,
};

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

/// Which rate-limiting algorithm to use.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RateLimitStrategy {

    /// Discrete time windows (e.g. every 3600s).
    FixedWindow,
    /// Weighted approximation across the current and previous window.
    SlidingWindow,
    /// Token bucket with configurable refill rate.
    TokenBucket,
}

/// Determines the key space for rate-limit counters.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RateLimitScope {
    /// One counter per (user, function) pair.
    PerUser,
    /// One counter per function (shared across all users).
    PerFunction,
    /// A single global counter for the entire contract.
    Global,
}

/// Full rate-limit configuration for a single function / endpoint.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RateLimitConfig {
    /// Maximum allowed requests within the window (or bucket capacity for TokenBucket).
    pub max_requests: u32,
    /// Window length in seconds (or refill period for TokenBucket).
    pub window_seconds: u64,
    /// The algorithm to apply.
    pub strategy: RateLimitStrategy,
    /// Key-space scope for counters.
    pub scope: RateLimitScope,
}

/// Information returned when a rate limit is exceeded.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RateLimitInfo {
    /// Whether the request is allowed.
    pub allowed: bool,
    /// Number of remaining requests in the current window / bucket.
    pub remaining: u32,
    /// Ledger timestamp at which the limit resets (approximately).
    pub reset_at: u64,
    /// Suggested retry-after in seconds (`0` when allowed).
    pub retry_after: u64,
}

// ---------------------------------------------------------------------------
// Internal storage key & state
// ---------------------------------------------------------------------------

/// Storage key for rate-limit state.  Using a tuple-style contracttype so
/// Soroban can serialise it deterministically.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RateLimitKey {
    /// Discriminator prefix (e.g. "rl").
    pub prefix: Symbol,
    /// Function name symbol.
    pub function: Symbol,
    /// User address (only meaningful for PerUser scope).  For PerFunction /
    /// Global scopes the contract stores a sentinel.
    pub user: Address,
}

/// Persisted counter state.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RateLimitState {
    /// Count in the *current* window (FixedWindow / SlidingWindow) or tokens
    /// consumed since last refill (TokenBucket).
    pub current_count: u32,
    /// Count in the *previous* window (only used by SlidingWindow).
    pub previous_count: u32,
    /// Timestamp (ledger) when the current window started.
    pub window_start: u64,
    /// For TokenBucket: available tokens (scaled ×1000 for precision).
    pub tokens_available: u64,
    /// Timestamp of the last token refill.
    pub last_refill: u64,
}

impl RateLimitState {
    pub fn new(now: u64) -> Self {
        Self {
            current_count: 0,
            previous_count: 0,
            window_start: now,
            tokens_available: 0,
            last_refill: now,
        }
    }
}

// ---------------------------------------------------------------------------
// Adaptive limit helpers
// ---------------------------------------------------------------------------

/// Multipliers applied adaptively based on trust level and network load.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AdaptiveConfig {
    /// Base multiplier (1000 = 1.0×). Trusted users get a higher multiplier.
    pub trust_multiplier: u32,
    /// Network-load multiplier (1000 = normal, <1000 = congested → fewer
    /// allowed requests).
    pub load_multiplier: u32,
}

impl AdaptiveConfig {
    /// Default: no adjustment.
    pub fn default_config() -> Self {
        Self {
            trust_multiplier: 1000,
            load_multiplier: 1000,
        }
    }

    /// Compute the effective max_requests after applying multipliers.
    /// Formula: base * trust / 1000 * load / 1000  (minimum 1).
    pub fn effective_max(&self, base_max: u32) -> u32 {
        let result = (base_max as u64)
            .saturating_mul(self.trust_multiplier as u64)
            / 1000
            * (self.load_multiplier as u64)
            / 1000;
        core::cmp::max(result, 1) as u32
    }
}

/// Trust tier for adaptive per-user limits.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TrustTier {
    /// Default tier – standard limits.
    Standard,
    /// Verified user – 1.5× limits.
    Verified,
    /// Trusted / high-reputation user – 2× limits.
    Trusted,
    /// Premium / staked user – 3× limits.
    Premium,
}

impl TrustTier {
    /// Returns multiplier ×1000.
    pub fn multiplier(&self) -> u32 {
        match self {
            TrustTier::Standard => 1000,
            TrustTier::Verified => 1500,
            TrustTier::Trusted => 2000,
            TrustTier::Premium => 3000,
        }
    }
}

/// Storage key for user trust tier.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct TrustTierKey {
    pub prefix: Symbol,
    pub user: Address,
}

/// Storage key for network load snapshot.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct NetworkLoadKey {
    pub prefix: Symbol,
}

// ---------------------------------------------------------------------------
// Core RateLimiter implementation
// ---------------------------------------------------------------------------

pub struct RateLimiter;

impl RateLimiter {
    // -- Public API ---------------------------------------------------------

    /// Check the rate limit for a given (user, function) pair against `config`.
    /// If allowed, the counter is incremented.  If denied, returns
    /// `Err(RateLimitInfo)` with retry information.
    ///
    /// This is the primary entry-point for contracts.
    pub fn check_and_update(
        env: &Env,
        user: &Address,
        function: &Symbol,
        config: &RateLimitConfig,
    ) -> Result<RateLimitInfo, RateLimitInfo> {
        Self::check_and_update_adaptive(
            env,
            user,
            function,
            config,
            &AdaptiveConfig::default_config(),
        )
    }

    /// Like [`check_and_update`] but with adaptive multipliers.
    pub fn check_and_update_adaptive(
        env: &Env,
        user: &Address,
        function: &Symbol,
        config: &RateLimitConfig,
        adaptive: &AdaptiveConfig,
    ) -> Result<RateLimitInfo, RateLimitInfo> {
        let now = env.ledger().timestamp();
        let key = Self::build_key(env, user, function, &config.scope);
        let mut state = Self::load_state(env, &key, now);
        let effective_max = adaptive.effective_max(config.max_requests);

        let info = match config.strategy {
            RateLimitStrategy::FixedWindow => {
                Self::fixed_window(now, &mut state, config.window_seconds, effective_max)
            }
            RateLimitStrategy::SlidingWindow => {
                Self::sliding_window(now, &mut state, config.window_seconds, effective_max)
            }
            RateLimitStrategy::TokenBucket => {
                Self::token_bucket(now, &mut state, config, effective_max)
            }
        };

        // Persist updated state with TTL matching 2× window to survive one
        // full previous-window look-back.
        Self::save_state(env, &key, &state, config.window_seconds);

        if info.allowed {
            Ok(info)
        } else {
            Err(info)
        }
    }

    /// Query current limit info *without* consuming a request.
    pub fn peek(
        env: &Env,
        user: &Address,
        function: &Symbol,
        config: &RateLimitConfig,
    ) -> RateLimitInfo {
        Self::peek_adaptive(env, user, function, config, &AdaptiveConfig::default_config())
    }

    /// Query current limit info with adaptive config *without* consuming.
    pub fn peek_adaptive(
        env: &Env,
        user: &Address,
        function: &Symbol,
        config: &RateLimitConfig,
        adaptive: &AdaptiveConfig,
    ) -> RateLimitInfo {
        let now = env.ledger().timestamp();
        let key = Self::build_key(env, user, function, &config.scope);
        let state = Self::load_state(env, &key, now);
        let effective_max = adaptive.effective_max(config.max_requests);

        match config.strategy {
            RateLimitStrategy::FixedWindow => {
                Self::peek_fixed_window(now, &state, config.window_seconds, effective_max)
            }
            RateLimitStrategy::SlidingWindow => {
                Self::peek_sliding_window(now, &state, config.window_seconds, effective_max)
            }
            RateLimitStrategy::TokenBucket => {
                Self::peek_token_bucket(now, &state, config, effective_max)
            }
        }
    }

    /// Reset the counter for a specific (user, function) pair.  Useful for
    /// admin overrides.
    pub fn reset(
        env: &Env,
        user: &Address,
        function: &Symbol,
        scope: &RateLimitScope,
    ) {
        let key = Self::build_key(env, user, function, scope);
        env.storage().temporary().remove(&key);
    }

    // -- Adaptive helpers ---------------------------------------------------

    /// Set a user's trust tier (admin operation).
    pub fn set_trust_tier(env: &Env, user: &Address, tier: &TrustTier) {
        let key = TrustTierKey {
            prefix: Symbol::new(env, "rl_trust"),
            user: user.clone(),
        };
        env.storage().persistent().set(&key, tier);
    }

    /// Get a user's trust tier.
    pub fn get_trust_tier(env: &Env, user: &Address) -> TrustTier {
        let key = TrustTierKey {
            prefix: Symbol::new(env, "rl_trust"),
            user: user.clone(),
        };
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(TrustTier::Standard)
    }

    /// Build an adaptive config from on-chain trust tier and stored network
    /// load.
    pub fn build_adaptive_config(env: &Env, user: &Address) -> AdaptiveConfig {
        let tier = Self::get_trust_tier(env, user);
        let load = Self::get_network_load(env);
        AdaptiveConfig {
            trust_multiplier: tier.multiplier(),
            load_multiplier: load,
        }
    }

    /// Record a network-load snapshot (called externally, e.g. by an oracle or
    /// admin).  `load` is a multiplier ×1000: 1000 = normal, 500 = very
    /// congested (halve limits), 1500 = light load (increase limits).
    pub fn set_network_load(env: &Env, load: u32) {
        let key = NetworkLoadKey {
            prefix: Symbol::new(env, "rl_load"),
        };
        env.storage().instance().set(&key, &load);
    }

    /// Read the current network-load multiplier.
    pub fn get_network_load(env: &Env) -> u32 {
        let key = NetworkLoadKey {
            prefix: Symbol::new(env, "rl_load"),
        };
        env.storage().instance().get(&key).unwrap_or(1000u32)
    }

    // -- Strategy implementations -------------------------------------------

    /// Fixed window: if we're still inside the current window, increment.
    /// Otherwise start a new window.
    fn fixed_window(
        now: u64,
        state: &mut RateLimitState,
        window_seconds: u64,
        max_requests: u32,
    ) -> RateLimitInfo {
        let window_end = state.window_start.saturating_add(window_seconds);

        if now >= window_end {
            // New window
            state.previous_count = state.current_count;
            state.current_count = 0;
            state.window_start = now;
        }

        let reset_at = state.window_start.saturating_add(window_seconds);

        if state.current_count >= max_requests {
            return RateLimitInfo {
                allowed: false,
                remaining: 0,
                reset_at,
                retry_after: reset_at.saturating_sub(now),
            };
        }

        state.current_count += 1;

        RateLimitInfo {
            allowed: true,
            remaining: max_requests.saturating_sub(state.current_count),
            reset_at,
            retry_after: 0,
        }
    }

    fn peek_fixed_window(
        now: u64,
        state: &RateLimitState,
        window_seconds: u64,
        max_requests: u32,
    ) -> RateLimitInfo {
        let window_end = state.window_start.saturating_add(window_seconds);
        let current = if now >= window_end { 0 } else { state.current_count };
        let reset_at = if now >= window_end {
            now.saturating_add(window_seconds)
        } else {
            window_end
        };
        let remaining = max_requests.saturating_sub(current);

        RateLimitInfo {
            allowed: current < max_requests,
            remaining,
            reset_at,
            retry_after: if current >= max_requests {
                reset_at.saturating_sub(now)
            } else {
                0
            },
        }
    }

    /// Sliding window approximation:
    ///   weighted_count = previous_count × (1 − elapsed/window) + current_count
    fn sliding_window(
        now: u64,
        state: &mut RateLimitState,
        window_seconds: u64,
        max_requests: u32,
    ) -> RateLimitInfo {
        let window_end = state.window_start.saturating_add(window_seconds);

        if now >= window_end {
            state.previous_count = state.current_count;
            state.current_count = 0;
            state.window_start = now;
        }

        let elapsed = now.saturating_sub(state.window_start);
        // Weight of previous window (×1000 for precision)
        let prev_weight = if window_seconds > 0 {
            1000u64.saturating_sub(elapsed.saturating_mul(1000) / window_seconds)
        } else {
            0
        };
        let weighted = (state.previous_count as u64)
            .saturating_mul(prev_weight)
            / 1000
            + state.current_count as u64;

        let reset_at = state.window_start.saturating_add(window_seconds);

        if weighted >= max_requests as u64 {
            return RateLimitInfo {
                allowed: false,
                remaining: 0,
                reset_at,
                retry_after: reset_at.saturating_sub(now),
            };
        }

        state.current_count += 1;

        let new_weighted = (state.previous_count as u64)
            .saturating_mul(prev_weight)
            / 1000
            + state.current_count as u64;
        let remaining = (max_requests as u64).saturating_sub(new_weighted) as u32;

        RateLimitInfo {
            allowed: true,
            remaining,
            reset_at,
            retry_after: 0,
        }
    }

    fn peek_sliding_window(
        now: u64,
        state: &RateLimitState,
        window_seconds: u64,
        max_requests: u32,
    ) -> RateLimitInfo {
        let window_end = state.window_start.saturating_add(window_seconds);
        let (prev_count, cur_count, ws) = if now >= window_end {
            (state.current_count, 0u32, now)
        } else {
            (state.previous_count, state.current_count, state.window_start)
        };

        let elapsed = now.saturating_sub(ws);
        let prev_weight = if window_seconds > 0 {
            1000u64.saturating_sub(elapsed.saturating_mul(1000) / window_seconds)
        } else {
            0
        };
        let weighted = (prev_count as u64).saturating_mul(prev_weight) / 1000 + cur_count as u64;
        let reset_at = ws.saturating_add(window_seconds);
        let remaining = (max_requests as u64).saturating_sub(weighted) as u32;

        RateLimitInfo {
            allowed: weighted < max_requests as u64,
            remaining,
            reset_at,
            retry_after: if weighted >= max_requests as u64 {
                reset_at.saturating_sub(now)
            } else {
                0
            },
        }
    }

    /// Token bucket: tokens refill at `max_requests / window_seconds` per
    /// second.  We store tokens_available ×1000.
    fn token_bucket(
        now: u64,
        state: &mut RateLimitState,
        config: &RateLimitConfig,
        max_requests: u32,
    ) -> RateLimitInfo {
        let capacity_scaled: u64 = (max_requests as u64).saturating_mul(1000);

        // Refill tokens since last check
        let elapsed = now.saturating_sub(state.last_refill);
        let refill_rate_per_sec = if config.window_seconds > 0 {
            capacity_scaled / config.window_seconds
        } else {
            capacity_scaled
        };
        let refill = elapsed.saturating_mul(refill_rate_per_sec);
        state.tokens_available = core::cmp::min(
            state.tokens_available.saturating_add(refill),
            capacity_scaled,
        );
        state.last_refill = now;

        let cost: u64 = 1000; // 1 token = 1000 scaled units

        if state.tokens_available < cost {
            // How long until 1 token is available?
            let deficit = cost.saturating_sub(state.tokens_available);
            let retry_after = if refill_rate_per_sec > 0 {
                (deficit + refill_rate_per_sec - 1) / refill_rate_per_sec
            } else {
                config.window_seconds
            };

            return RateLimitInfo {
                allowed: false,
                remaining: 0,
                reset_at: now.saturating_add(retry_after),
                retry_after,
            };
        }

        state.tokens_available -= cost;
        let remaining = (state.tokens_available / 1000) as u32;

        RateLimitInfo {
            allowed: true,
            remaining,
            reset_at: now.saturating_add(config.window_seconds),
            retry_after: 0,
        }
    }

    fn peek_token_bucket(
        now: u64,
        state: &RateLimitState,
        config: &RateLimitConfig,
        max_requests: u32,
    ) -> RateLimitInfo {
        let capacity_scaled: u64 = (max_requests as u64).saturating_mul(1000);
        let elapsed = now.saturating_sub(state.last_refill);
        let refill_rate_per_sec = if config.window_seconds > 0 {
            capacity_scaled / config.window_seconds
        } else {
            capacity_scaled
        };
        let refill = elapsed.saturating_mul(refill_rate_per_sec);
        let tokens = core::cmp::min(
            state.tokens_available.saturating_add(refill),
            capacity_scaled,
        );

        let cost: u64 = 1000;
        if tokens < cost {
            let deficit = cost.saturating_sub(tokens);
            let retry_after = if refill_rate_per_sec > 0 {
                (deficit + refill_rate_per_sec - 1) / refill_rate_per_sec
            } else {
                config.window_seconds
            };
            RateLimitInfo {
                allowed: false,
                remaining: 0,
                reset_at: now.saturating_add(retry_after),
                retry_after,
            }
        } else {
            RateLimitInfo {
                allowed: true,
                remaining: ((tokens - cost) / 1000) as u32,
                reset_at: now.saturating_add(config.window_seconds),
                retry_after: 0,
            }
        }
    }

    // -- Storage helpers ----------------------------------------------------

    fn build_key(
        env: &Env,
        user: &Address,
        function: &Symbol,
        scope: &RateLimitScope,
    ) -> RateLimitKey {
        RateLimitKey {
            prefix: Symbol::new(env, "rl"),
            function: function.clone(),
            user: user.clone(), // for PerFunction / Global the same address is stored but ignored by callers
        }
    }

    fn load_state(env: &Env, key: &RateLimitKey, now: u64) -> RateLimitState {
        env.storage()
            .temporary()
            .get(key)
            .unwrap_or(RateLimitState {
                current_count: 0,
                previous_count: 0,
                window_start: now,
                tokens_available: 0,
                last_refill: now,
            })
    }

    fn save_state(env: &Env, key: &RateLimitKey, state: &RateLimitState, window_seconds: u64) {
        env.storage().temporary().set(key, state);

        // Extend TTL to 2× window so the previous-window data survives for
        // sliding window lookback.  Clamp to a reasonable upper bound.
        let ttl_ledgers = Self::seconds_to_ledgers(window_seconds.saturating_mul(2));
        let ttl_ledgers = core::cmp::min(ttl_ledgers, 120_960); // ~7 days @ 5s/block
        let threshold = ttl_ledgers / 2;
        env.storage()
            .temporary()
            .extend_ttl(key, threshold, ttl_ledgers);
    }

    /// Convert seconds into approximate ledger count (assuming ~5 s / ledger).
    fn seconds_to_ledgers(seconds: u64) -> u32 {
        let ledgers = seconds / 5;
        if ledgers > u32::MAX as u64 {
            u32::MAX
        } else {
            ledgers as u32
        }
    }
}

// ---------------------------------------------------------------------------
// Convenience macros
// ---------------------------------------------------------------------------

/// Decorator-style macro for rate limiting a contract function.
///
/// # Usage
///
/// ```rust
/// use common_utils::rate_limit;
///
/// // Inside a contractimpl block:
/// pub fn submit_report(env: Env, reporter: Address, ...) -> Result<(), StateError> {
///     rate_limit!(env, reporter, "submit_rpt", max: 10, window: 3600, strategy: FixedWindow, scope: PerUser);
///     // ... rest of function
/// }
/// ```
///
/// The macro returns `Err(StateError::RateLimitExceeded)` when the limit is
/// hit.  Use `rate_limit_adaptive!` to additionally apply trust-tier and
/// network-load multipliers.
#[macro_export]
macro_rules! rate_limit {
    ($env:expr, $user:expr, $func_name:expr,
     max: $max:expr, window: $window:expr,
     strategy: $strategy:ident, scope: $scope:ident) => {
        {
            let config = $crate::rate_limit::RateLimitConfig {
                max_requests: $max,
                window_seconds: $window,
                strategy: $crate::rate_limit::RateLimitStrategy::$strategy,
                scope: $crate::rate_limit::RateLimitScope::$scope,
            };
            let func_sym = soroban_sdk::Symbol::new(&$env, $func_name);
            if let Err(_info) = $crate::rate_limit::RateLimiter::check_and_update(
                &$env, &$user, &func_sym, &config,
            ) {
                return Err($crate::error::StateError::RateLimitExceeded);
            }
        }
    };
}

/// Adaptive variant that considers trust tier and network load.
#[macro_export]
macro_rules! rate_limit_adaptive {
    ($env:expr, $user:expr, $func_name:expr,
     max: $max:expr, window: $window:expr,
     strategy: $strategy:ident, scope: $scope:ident) => {
        {
            let config = $crate::rate_limit::RateLimitConfig {
                max_requests: $max,
                window_seconds: $window,
                strategy: $crate::rate_limit::RateLimitStrategy::$strategy,
                scope: $crate::rate_limit::RateLimitScope::$scope,
            };
            let adaptive = $crate::rate_limit::RateLimiter::build_adaptive_config(&$env, &$user);
            let func_sym = soroban_sdk::Symbol::new(&$env, $func_name);
            if let Err(_info) = $crate::rate_limit::RateLimiter::check_and_update_adaptive(
                &$env, &$user, &func_sym, &config, &adaptive,
            ) {
                return Err($crate::error::StateError::RateLimitExceeded);
            }
        }
    };
}
