# Rate Limiting Framework

## Overview

The rate limiting framework prevents abuse of contract functions by enforcing configurable request limits. It supports per-user, per-function, and global rate limiting with three different algorithms and an adaptive system that adjusts limits based on user trust level and network congestion.

## Architecture

```
common-utils/contract/src/rate_limit.rs     ← Core framework
common-utils/contract/src/rate_limit_tests.rs ← Comprehensive tests
fraud-detect/src/lib.rs                      ← Integration (submit_report, get_reports)
credit-score/src/lib.rs                      ← Integration (calculate_score, get_score, set_score, update_factors)
```

## Rate Limiting Strategies

### 1. Fixed Window
Divides time into discrete windows (e.g., every 3600 seconds). Each window has independent counters that reset at the window boundary.

**Best for:** Simple limits where occasional bursts at window boundaries are acceptable.

```rust
rate_limit!(env, user, "my_func",
    max: 10, window: 3600,
    strategy: FixedWindow, scope: PerUser);
```

### 2. Sliding Window
Approximates a true sliding window by weighting the previous window's count by the fraction of the window that hasn't elapsed yet. This smooths out the boundary-burst problem of fixed windows.

**Formula:** `weighted_count = prev_count × (1 − elapsed/window) + current_count`

**Best for:** Smoother rate limiting that prevents gaming of window boundaries.

```rust
rate_limit!(env, user, "submit_rpt",
    max: 10, window: 3600,
    strategy: SlidingWindow, scope: PerUser);
```

### 3. Token Bucket
Allows bursts up to the bucket capacity, with tokens refilling at a steady rate (`max_requests / window_seconds` per second). Ideal for APIs where occasional bursts are legitimate but sustained high rates should be throttled.

**Best for:** Read endpoints where burst traffic is normal.

```rust
rate_limit!(env, user, "get_score",
    max: 60, window: 3600,
    strategy: TokenBucket, scope: PerUser);
```

## Scopes

| Scope | Description |
|-------|-------------|
| `PerUser` | Independent counter per (user, function) pair |
| `PerFunction` | Shared counter per function across all users |
| `Global` | Single counter for the entire contract |

## Adaptive Rate Limiting

The framework supports dynamic limit adjustment based on two factors:

### Trust Tiers
Users can be assigned trust tiers that multiply their base limits:

| Tier | Multiplier | Example (base=10) |
|------|-----------|-------------------|
| Standard | 1.0× | 10 requests |
| Verified | 1.5× | 15 requests |
| Trusted | 2.0× | 20 requests |
| Premium | 3.0× | 30 requests |

```rust
// Admin sets a user's trust tier
RateLimiter::set_trust_tier(&env, &user, &TrustTier::Trusted);
```

### Network Load
An oracle or admin can report network congestion, which scales all limits accordingly:

| Load Value | Meaning | Effect (base=10) |
|-----------|---------|-------------------|
| 500 | Heavy congestion | 5 requests (halved) |
| 1000 | Normal | 10 requests |
| 1500 | Light load | 15 requests (1.5×) |

```rust
// Admin/oracle updates network load
RateLimiter::set_network_load(&env, 500); // congested
```

### Using Adaptive Limits

```rust
// Automatically applies trust tier + network load
rate_limit_adaptive!(env, user, "submit_rpt",
    max: 10, window: 3600,
    strategy: SlidingWindow, scope: PerUser);
```

## Rate Limit Info

When a request is denied, the `RateLimitInfo` struct provides:

| Field | Description |
|-------|-------------|
| `allowed` | `false` when limit exceeded |
| `remaining` | Requests remaining in current window |
| `reset_at` | Timestamp when the limit resets |
| `retry_after` | Seconds to wait before retrying |

## Current Limits

### fraud-detect Contract

| Function | Limit | Window | Strategy | Scope |
|----------|-------|--------|----------|-------|
| `submit_report` | 10/hr | 3600s | SlidingWindow | PerUser |
| `get_reports` | 30/hr | 3600s | FixedWindow | PerFunction |

### credit-score Contract

| Function | Limit | Window | Strategy | Scope |
|----------|-------|--------|----------|-------|
| `get_score` | 60/hr | 3600s | TokenBucket | PerUser |
| `update_factors` | 20/hr | 3600s | FixedWindow | Global |
| `set_score` | 30/hr | 3600s | SlidingWindow | PerUser |

## Storage

Rate limit state is stored in **temporary storage** with auto-expiring TTLs:
- TTL is set to 2× the window length to support sliding window lookback
- Capped at ~7 days (120,960 ledgers at 5s/block)
- No permanent storage footprint from rate limiting

## Testing

```bash
# Run all rate limit tests
cargo test --package common-utils --lib rate_limit

# Run specific test groups
cargo test --package common-utils --lib rate_limit_tests::test_fixed_window
cargo test --package common-utils --lib rate_limit_tests::test_sliding_window
cargo test --package common-utils --lib rate_limit_tests::test_token_bucket
cargo test --package common-utils --lib rate_limit_tests::test_adaptive
cargo test --package common-utils --lib rate_limit_tests::test_under_simulated_load
```

## Design Decisions

1. **Temporary storage for counters**: Rate limit state is ephemeral — if it expires, limits reset gracefully (fail-open for legitimate users).
2. **Scaled token bucket**: Tokens are stored ×1000 for integer precision without floating point.
3. **Macro-based enforcement**: `rate_limit!` and `rate_limit_adaptive!` macros provide decorator-style usage with zero boilerplate.
4. **Minimum effective limit of 1**: Even with extreme adaptive multipliers, at least 1 request is always allowed per window.
5. **No false positives**: The `StateError::RateLimitExceeded` error code (1407) is returned only when the limit is genuinely exceeded.
