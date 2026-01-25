/// Testnet Faucet Contract
/// Rate-limited token/agent distribution for development
/// Prevents abuse through address limits and time-based rate limiting

use soroban_sdk::{
    contract, contractimpl, panic_with_error, Symbol, Address, Env, contracterror, 
    contracttype, token,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum FaucetError {
    NotAdmin = 1,
    AlreadyInitialized = 2,
    RateLimitExceeded = 3,
    AddressLimitExceeded = 4,
    InvalidAmount = 5,
    UnauthorizedCaller = 6,
}

/// Faucet configuration stored in persistent storage
#[contracttype]
#[derive(Clone, Debug)]
pub struct FaucetConfig {
    pub admin: Address,
    pub token_contract: Address,
    pub amount_per_claim: i128,
    pub rate_limit_window: u64, // seconds
    pub claims_per_window: u32,
    pub max_total_claims_per_address: u32,
}

#[contract]
pub struct FaucetContract;

// Storage key helpers
fn config_key() -> Symbol {
    Symbol::new(&Env::default(), "faucet_cfg")
}

fn total_claims_key(address: &Address) -> (Symbol, Address) {
    (Symbol::new(&Env::default(), "faucet_claims"), address.clone())
}

fn claim_window_key(address: &Address) -> (Symbol, Address) {
    (Symbol::new(&Env::default(), "faucet_window"), address.clone())
}

fn last_claim_key(address: &Address) -> (Symbol, Address) {
    (Symbol::new(&Env::default(), "faucet_last"), address.clone())
}

#[contractimpl]
impl FaucetContract {
    /// Initialize the faucet contract
    pub fn initialize(
        env: Env,
        admin: Address,
        token_contract: Address,
        amount_per_claim: i128,
        rate_limit_window: u64,
        claims_per_window: u32,
        max_total_claims_per_address: u32,
    ) {
        // Verify admin
        admin.require_auth();

        // Check if already initialized
        if env.storage().persistent().has(&config_key()) {
            panic_with_error!(&env, FaucetError::AlreadyInitialized);
        }

        let config = FaucetConfig {
            admin: admin.clone(),
            token_contract,
            amount_per_claim,
            rate_limit_window,
            claims_per_window,
            max_total_claims_per_address,
        };

        env.storage().persistent().set(&config_key(), &config);
        
        env.events().publish(
            (Symbol::new(&env, "FaucetInit"),),
            (&admin, amount_per_claim, rate_limit_window, claims_per_window),
        );
    }

    /// Claim tokens from the faucet
    pub fn claim(env: Env, claimer: Address) -> i128 {
        claimer.require_auth();

        let config: FaucetConfig = env
            .storage()
            .persistent()
            .get(&config_key())
            .expect("Faucet not initialized");

        let now = env.ledger().timestamp();

        // Check rate limit (claims per window)
        Self::check_rate_limit(&env, &claimer, &config, now);

        // Check total claims limit
        Self::check_total_claims_limit(&env, &claimer, &config);

        // Transfer tokens to claimer
        let token_client = token::Client::new(&env, &config.token_contract);
        token_client.transfer(&config.admin, &claimer, &config.amount_per_claim);

        // Update claim records
        Self::update_claim_records(&env, &claimer, config.amount_per_claim, now);

        // Emit FaucetIssued event
        env.events().publish(
            (Symbol::new(&env, "FaucetIssued"),),
            (&claimer, config.amount_per_claim, now),
        );

        config.amount_per_claim
    }

    /// Get remaining claims for address in current window
    pub fn get_remaining_claims(env: Env, address: Address) -> u32 {
        let config: FaucetConfig = env
            .storage()
            .persistent()
            .get(&config_key())
            .expect("Faucet not initialized");

        let now = env.ledger().timestamp();
        let claims = Self::count_recent_claims(&env, &address, &config, now);

        config.claims_per_window.saturating_sub(claims)
    }

    /// Get total claims made by address
    pub fn get_total_claims(env: Env, address: Address) -> u32 {
        env.storage()
            .persistent()
            .get::<_, u32>(&total_claims_key(&address))
            .unwrap_or(0)
    }

    /// Update faucet configuration (admin only)
    pub fn update_config(
        env: Env,
        admin: Address,
        amount_per_claim: i128,
        rate_limit_window: u64,
        claims_per_window: u32,
        max_total_claims_per_address: u32,
    ) {
        admin.require_auth();

        let mut config: FaucetConfig = env
            .storage()
            .persistent()
            .get(&config_key())
            .expect("Faucet not initialized");

        // Verify caller is admin
        if config.admin != admin {
            panic_with_error!(&env, FaucetError::UnauthorizedCaller);
        }

        config.amount_per_claim = amount_per_claim;
        config.rate_limit_window = rate_limit_window;
        config.claims_per_window = claims_per_window;
        config.max_total_claims_per_address = max_total_claims_per_address;

        env.storage().persistent().set(&config_key(), &config);

        env.events().publish(
            (Symbol::new(&env, "FaucetConfigUpdated"),),
            (amount_per_claim, rate_limit_window, claims_per_window),
        );
    }

    /// Get current faucet configuration
    pub fn get_config(env: Env) -> FaucetConfig {
        env.storage()
            .persistent()
            .get(&config_key())
            .expect("Faucet not initialized")
    }

    // ==================== INTERNAL HELPERS ====================

    /// Check if address exceeds rate limit for current window
    fn check_rate_limit(
        env: &Env,
        address: &Address,
        config: &FaucetConfig,
        now: u64,
    ) {
        let claims_in_window = Self::count_recent_claims(env, address, config, now);
        if claims_in_window >= config.claims_per_window {
            panic_with_error!(env, FaucetError::RateLimitExceeded);
        }
    }

    /// Check if address exceeds total claims limit
    fn check_total_claims_limit(env: &Env, address: &Address, config: &FaucetConfig) {
        let total_claims = env
            .storage()
            .persistent()
            .get::<_, u32>(&total_claims_key(address))
            .unwrap_or(0);

        if total_claims >= config.max_total_claims_per_address {
            panic_with_error!(env, FaucetError::AddressLimitExceeded);
        }
    }

    /// Count claims made in the current rate limit window
    fn count_recent_claims(env: &Env, address: &Address, config: &FaucetConfig, now: u64) -> u32 {
        let last_window_start = now.saturating_sub(config.rate_limit_window);
        
        let last_claim_time = env
            .storage()
            .persistent()
            .get::<_, u64>(&last_claim_key(address))
            .unwrap_or(0);

        // If last claim was in current window, retrieve persisted count
        if last_claim_time > last_window_start {
            env.storage()
                .persistent()
                .get::<_, u32>(&claim_window_key(address))
                .unwrap_or(1)
        } else {
            // New window, reset counter
            0
        }
    }

    /// Update claim records after successful claim
    fn update_claim_records(env: &Env, address: &Address, _amount: i128, timestamp: u64) {
        // Increment claims in current window
        let claims_in_window = env
            .storage()
            .persistent()
            .get::<_, u32>(&claim_window_key(address))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&claim_window_key(address), &(claims_in_window + 1));

        // Update last claim time
        env.storage()
            .persistent()
            .set(&last_claim_key(address), &timestamp);

        // Increment total claims
        let total_claims = env
            .storage()
            .persistent()
            .get::<_, u32>(&total_claims_key(address))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&total_claims_key(address), &(total_claims + 1));
    }
}
