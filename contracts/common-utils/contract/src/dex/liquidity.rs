use soroban_sdk::{contracttype, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct LiquidityDepth {
    pub pair: super::adapter::TokenPair,
    pub levels: Vec<DepthLevel>,
    pub total_bid_liquidity: i128,
    pub total_ask_liquidity: i128,
    pub spread_bps: u32,
    pub timestamp: u64,
}

impl LiquidityDepth {
    pub fn new(env: &Env, pair: super::adapter::TokenPair) -> Self {
        Self {
            pair,
            levels: Vec::new(env),
            total_bid_liquidity: 0,
            total_ask_liquidity: 0,
            spread_bps: 0,
            timestamp: env.ledger().timestamp(),
        }
    }

    pub fn add_level(&mut self, level: DepthLevel) {
        if level.is_bid {
            self.total_bid_liquidity += level.liquidity;
        } else {
            self.total_ask_liquidity += level.liquidity;
        }
        self.levels.push_back(level);
    }

    pub fn total_liquidity(&self) -> i128 {
        self.total_bid_liquidity + self.total_ask_liquidity
    }

    pub fn imbalance_ratio(&self) -> i128 {
        let total = self.total_liquidity();
        if total == 0 {
            return 0;
        }
        let diff = if self.total_bid_liquidity > self.total_ask_liquidity {
            self.total_bid_liquidity - self.total_ask_liquidity
        } else {
            self.total_ask_liquidity - self.total_bid_liquidity
        };
        (diff * 10000) / total
    }

    pub fn effective_spread_bps(&self) -> u32 {
        self.spread_bps
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct DepthLevel {
    pub price: i128,
    pub liquidity: i128,
    pub cumulative: i128,
    pub is_bid: bool,
    pub distance_from_mid_bps: u32,
}

impl DepthLevel {
    pub fn new(
        price: i128,
        liquidity: i128,
        cumulative: i128,
        is_bid: bool,
        distance_from_mid_bps: u32,
    ) -> Self {
        Self {
            price,
            liquidity,
            cumulative,
            is_bid,
            distance_from_mid_bps,
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PoolInfo {
    pub pair: super::adapter::TokenPair,
    pub reserve_a: i128,
    pub reserve_b: i128,
    pub total_supply_lp: i128,
    pub fee_bps: u32,
    pub created_at: u64,
    pub last_updated: u64,
    pub tvl_usd: i128,
}

impl PoolInfo {
    pub fn new(
        env: &Env,
        pair: super::adapter::TokenPair,
        reserve_a: i128,
        reserve_b: i128,
        fee_bps: u32,
    ) -> Self {
        let timestamp = env.ledger().timestamp();
        Self {
            pair,
            reserve_a,
            reserve_b,
            total_supply_lp: 0,
            fee_bps,
            created_at: timestamp,
            last_updated: timestamp,
            tvl_usd: 0,
        }
    }

    pub fn price_a_to_b(&self) -> i128 {
        if self.reserve_a == 0 {
            return 0;
        }
        (self.reserve_b * 10_000_000_000) / self.reserve_a
    }

    pub fn price_b_to_a(&self) -> i128 {
        if self.reserve_b == 0 {
            return 0;
        }
        (self.reserve_a * 10_000_000_000) / self.reserve_b
    }

    pub fn effective_reserve(&self) -> i128 {
        self.reserve_a + self.reserve_b
    }

    pub fn k_value(&self) -> i128 {
        self.reserve_a * self.reserve_b
    }

    pub fn output_amount(&self, input_amount: i128, is_a_to_b: bool) -> i128 {
        let (input_reserve, output_reserve) = if is_a_to_b {
            (self.reserve_a, self.reserve_b)
        } else {
            (self.reserve_b, self.reserve_a)
        };

        if input_reserve == 0 || output_reserve == 0 {
            return 0;
        }

        let fee_numerator = 10000 - self.fee_bps as i128;
        let input_with_fee = input_amount * fee_numerator;
        let numerator = input_with_fee * output_reserve;
        let denominator = (input_reserve * 10000) + input_with_fee;

        numerator / denominator
    }

    pub fn impact_for_trade(&self, input_amount: i128, is_a_to_b: bool) -> u32 {
        let input_reserve = if is_a_to_b {
            self.reserve_a
        } else {
            self.reserve_b
        };
        if input_reserve == 0 {
            return 10000;
        }
        ((input_amount * 10000) / input_reserve) as u32
    }
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct LiquidityMetrics {
    pub pair: super::adapter::TokenPair,
    pub total_liquidity_usd: i128,
    pub liquidity_locked: i128,
    pub liquidity_change_24h_bps: i32,
    pub depth_score: u32,
    pub efficiency_score: u32,
    pub timestamp: u64,
}

impl LiquidityMetrics {
    pub fn new(env: &Env, pair: super::adapter::TokenPair) -> Self {
        Self {
            pair,
            total_liquidity_usd: 0,
            liquidity_locked: 0,
            liquidity_change_24h_bps: 0,
            depth_score: 0,
            efficiency_score: 0,
            timestamp: env.ledger().timestamp(),
        }
    }

    pub fn with_total_liquidity(mut self, total: i128) -> Self {
        self.total_liquidity_usd = total;
        self
    }

    pub fn with_change(mut self, change_bps: i32) -> Self {
        self.liquidity_change_24h_bps = change_bps;
        self
    }

    pub fn calculate_scores(&mut self, depth: &LiquidityDepth) {
        self.depth_score = self.calculate_depth_score(depth);
        self.efficiency_score = self.calculate_efficiency_score(depth);
    }

    fn calculate_depth_score(&self, depth: &LiquidityDepth) -> u32 {
        let total = depth.total_liquidity();
        if total == 0 {
            return 0;
        }

        let spread_penalty = depth.spread_bps / 10;
        let imbalance_penalty = (depth.imbalance_ratio() / 100) as u32;

        let base_score = if total > 100_000_000 {
            100
        } else if total > 10_000_000 {
            80
        } else if total > 1_000_000 {
            60
        } else if total > 100_000 {
            40
        } else {
            20
        };

        base_score
            .saturating_sub(spread_penalty)
            .saturating_sub(imbalance_penalty)
    }

    fn calculate_efficiency_score(&self, depth: &LiquidityDepth) -> u32 {
        let levels_count = depth.levels.len() as u32;

        let distribution_score = if levels_count >= 20 {
            100
        } else if levels_count >= 10 {
            80
        } else if levels_count >= 5 {
            60
        } else {
            40
        };

        let spread_score = if depth.spread_bps <= 10 {
            100
        } else if depth.spread_bps <= 50 {
            80
        } else if depth.spread_bps <= 100 {
            60
        } else {
            40
        };

        (distribution_score + spread_score) / 2
    }

    pub fn liquidity_health_score(&self) -> u32 {
        let base = if self.total_liquidity_usd > 50_000_000 {
            100
        } else if self.total_liquidity_usd > 10_000_000 {
            80
        } else if self.total_liquidity_usd > 1_000_000 {
            60
        } else if self.total_liquidity_usd > 100_000 {
            40
        } else {
            20
        };

        let change_penalty = if self.liquidity_change_24h_bps < -2000 {
            20
        } else if self.liquidity_change_24h_bps < -1000 {
            10
        } else {
            0
        };

        base.saturating_sub(change_penalty)
    }
}

#[contracttype]
pub enum DataKey {
    PoolInfo(super::adapter::TokenPair),
    LiquidityDepth(super::adapter::TokenPair),
    LiquidityMetrics(super::adapter::TokenPair),
    HistoricalLiquidity(super::adapter::TokenPair, u64),
}
