# Validator Framework Documentation

## Overview

The Validator Framework provides a comprehensive, reusable validation system for Soroban smart contracts. It centralizes validation logic that was previously scattered across contracts and provides configurable validators with composition support.

## Features

- **Reusable Validators**: CID, Hash, Bytes, and Address validators
- **Configurable Bounds**: Per-contract validation configuration
- **Validator Composition**: Combine multiple validators with different modes
- **Error Context**: Rich error reporting with context information
- **Validator Registry**: Centralized validator management
- **Type Safety**: Strongly typed validation with Rust's type system

## Core Components

### Validator Trait

The core trait that all validators implement:

```rust
pub trait Validator<T> {
    fn validate(&self, env: &Env, input: &T) -> Result<(), ValidationError>;
    fn validate_with_context(&self, env: &Env, input: &T, context: ErrorContext) -> Result<(), ValidationError>;
    fn name(&self) -> &'static str;
}
```

### ValidatorConfig

Configuration structure for customizing validator behavior:

```rust
pub struct ValidatorConfig {
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub allow_empty: bool,
    pub strict_mode: bool,
    pub custom_error: Option<ValidationError>,
}
```

## Available Validators

### 1. CIDValidator

Validates Content Identifier (CID) formats with configurable bounds.

```rust
use common_utils::validator::{CIDValidator, ValidatorConfig};

// Default configuration
let validator = CIDValidator::new();

// Custom configuration
let custom_validator = CIDValidator::with_config(
    ValidatorConfig::new()
        .with_length_bounds(5, 150)
        .strict(false)
        .allow_empty(false)
);

// Predefined configurations
let lenient = CIDValidator::lenient();
let strict = CIDValidator::strict();
```

**Features:**
- Configurable length bounds
- Strict/lenient mode
- CID prefix validation in strict mode
- Hex character validation

### 2. HashValidator

Validates hash formats with algorithm-specific support.

```rust
use common_utils::validator::{HashValidator, HashAlgorithm, ValidatorConfig};

// Default configuration
let validator = HashValidator::new();

// Algorithm-specific validators
let sha256_validator = HashValidator::sha256();
let sha512_validator = HashValidator::sha512();

// Custom configuration with algorithm
let custom_validator = HashValidator::new()
    .with_algorithm(HashAlgorithm::Keccak256)
    .verify_checksum(true)
    .with_config(ValidatorConfig::new().strict(true));
```

**Supported Algorithms:**
- SHA256 (64 hex characters)
- SHA512 (128 hex characters)
- Keccak256 (64 hex characters)
- MD5 (32 hex characters)
- Custom (user-defined)

### 3. BytesValidator

General-purpose bytes validator with pattern matching.

```rust
use common_utils::validator::{BytesValidator, BytesPattern, ValidatorConfig};

// Default configuration
let validator = BytesValidator::new();

// Pattern-specific validators
let hex_validator = BytesValidator::hex_only();
let base64_validator = BytesValidator::base64();
let utf8_validator = BytesValidator::utf8();

// Custom pattern
let custom_validator = BytesValidator::new()
    .with_config(ValidatorConfig::new().with_length_bounds(10, 1000))
    .with_pattern(BytesPattern::Custom(|bytes| {
        // Custom validation logic
        bytes.len() >= 10 && bytes[0] == 0xFF
    }));
```

**Supported Patterns:**
- HexOnly: Validates hexadecimal characters only
- Base64: Validates Base64 encoded data
- Utf8: Validates UTF-8 encoded strings
- Custom: User-defined validation function

### 4. AddressValidator

Validates Stellar addresses with zero-address checking.

```rust
use common_utils::validator::{AddressValidator, ValidatorConfig};

// Default configuration
let validator = AddressValidator::new();

// Allow zero address
let permissive_validator = AddressValidator::new().allow_zero(true);

// Custom configuration
let custom_validator = AddressValidator::with_config(
    ValidatorConfig::new().allow_empty(false)
);
```

## Validator Composition

Combine multiple validators with different composition modes:

```rust
use common_utils::validator::{ComposedValidator, CompositionMode, CIDValidator, HashValidator};

// All validators must pass
let all_validators = ComposedValidator::all_validators()
    .add_validator(CIDValidator::new())
    .add_validator(HashValidator::sha256());

// Any validator can pass
let any_validator = ComposedValidator::any_validator()
    .add_validator(CIDValidator::lenient())
    .add_validator(HashValidator::new());

// Use first validator that passes
let first_match = ComposedValidator::first_match()
    .add_validator(CIDValidator::strict())
    .add_validator(CIDValidator::lenient());
```

**Composition Modes:**
- `All`: All validators must pass (AND logic)
- `Any`: Any validator can pass (OR logic)
- `First`: Use first validator that passes

## Error Handling

The framework provides rich error context:

```rust
use common_utils::validator::{CIDValidator, ErrorContext};

let validator = CIDValidator::new();
let context = ErrorContext::new("validate_metadata")
    .with_field("json_cid")
    .with_expected(Bytes::from_slice(&env, b"valid CID"))
    .with_actual(Bytes::from_slice(&env, b"invalid"))
    .with_suggestion("Use a valid CID format");

match validator.validate_with_context(&env, &input, context) {
    Ok(()) => // Validation passed
    Err(error) => {
        // Rich error information available
        println!("Validation failed: {:?}", error);
    }
}
```

## Integration Example: Agent Metadata

Here's how to integrate the validator framework into a contract:

```rust
use common_utils::validator::{Validator, CIDValidator, HashValidator, BytesValidator, ValidatorConfig};
use common_utils::error::ValidationError;

pub struct MetadataValidator {
    cid_validator: CIDValidator,
    hash_validator: HashValidator,
    name_validator: BytesValidator,
    description_validator: BytesValidator,
    version_validator: BytesValidator,
}

impl MetadataValidator {
    pub fn new() -> Self {
        Self {
            cid_validator: CIDValidator::new(),
            hash_validator: HashValidator::new(),
            name_validator: BytesValidator::new()
                .with_config(ValidatorConfig::new().with_length_bounds(1, 100)),
            description_validator: BytesValidator::new()
                .with_config(ValidatorConfig::new().with_length_bounds(1, 1000)),
            version_validator: BytesValidator::new()
                .with_config(ValidatorConfig::new().with_length_bounds(1, 50)),
        }
    }
    
    pub fn validate_and_parse(
        &self,
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
        name: Bytes,
        description: Bytes,
        version: Bytes,
        extra_fields: Vec<(Bytes, Bytes)>,
    ) -> Result<AgentMetadata, ValidationError> {
        // Validate each component
        self.cid_validator.validate(env, &json_cid)?;
        self.hash_validator.validate(env, &model_hash)?;
        self.name_validator.validate(env, &name)?;
        self.description_validator.validate(env, &description)?;
        self.version_validator.validate(env, &version)?;
        
        // Create metadata object
        Ok(AgentMetadata {
            json_cid,
            model_hash,
            name,
            description,
            version,
            extra_fields,
        })
    }
}
```

## Per-Contract Configuration

Contracts can define their own validation requirements:

```rust
// Strict contract configuration
let strict_config = MetadataValidator::with_config(
    ValidatorConfig::new().with_length_bounds(20, 100).strict(true),  // CID
    ValidatorConfig::new().with_length_bounds(64, 64).strict(true),   // Hash
    ValidatorConfig::new().with_length_bounds(5, 50).strict(true),     // Name
    ValidatorConfig::new().with_length_bounds(20, 500).strict(true),   // Description
    ValidatorConfig::new().with_length_bounds(5, 20).strict(true),     // Version
);

// Lenient contract configuration
let lenient_config = MetadataValidator::with_config(
    ValidatorConfig::new().with_length_bounds(5, 200).strict(false),   // CID
    ValidatorConfig::new().with_length_bounds(10, 200).strict(false),  // Hash
    ValidatorConfig::new().with_length_bounds(1, 100).strict(false),   // Name
    ValidatorConfig::new().with_length_bounds(1, 1000).strict(false),  // Description
    ValidatorConfig::new().with_length_bounds(1, 50).strict(false),    // Version
);
```

## Validator Registry

Centralized validator management:

```rust
use common_utils::validator::ValidatorRegistry;

let registry = ValidatorRegistry::new(&env);

// Register validators
registry.register("strict_cid", CIDValidator::strict());
registry.register("lenient_hash", HashValidator::new().strict(false));

// Retrieve validators (in a real implementation)
if let Some(validator) = registry.get::<Bytes>("strict_cid") {
    validator.validate(&env, &input)?;
}
```

## Migration Guide

### From Old Validation Logic

**Before:**
```rust
// Scattered validation logic
if len < MIN_CID_LENGTH || len > MAX_CID_LENGTH {
    return Err(MetadataError::InvalidCidFormat);
}
if !cid::is_valid_cid(&json_cid) {
    return Err(MetadataError::InvalidCidFormat);
}
```

**After:**
```rust
// Centralized, configurable validation
self.cid_validator.validate(env, &json_cid)
    .map_err(|_| MetadataError::InvalidCidFormat)?;
```

### Benefits of Migration

1. **Centralized Logic**: All validation in one place
2. **Configurability**: Per-contract validation rules
3. **Reusability**: Same validators across contracts
4. **Better Error Handling**: Rich error context
5. **Type Safety**: Compile-time validation guarantees
6. **Testability**: Easier unit testing of validation logic

## Best Practices

### 1. Use Appropriate Validators

```rust
// Good: Use specific validators
let cid_validator = CIDValidator::new();
let hash_validator = HashValidator::sha256();

// Avoid: Generic validation for specific formats
let bytes_validator = BytesValidator::new(); // Less specific
```

### 2. Configure for Your Use Case

```rust
// Good: Configure for your requirements
let validator = CIDValidator::with_config(
    ValidatorConfig::new()
        .with_length_bounds(10, 100)
        .strict(true)
        .allow_empty(false)
);

// Avoid: Using defaults when they don't fit your needs
let validator = CIDValidator::new(); // May not be appropriate
```

### 3. Provide Error Context

```rust
// Good: Provide context for debugging
let context = ErrorContext::new("validate_agent_metadata")
    .with_field("json_cid")
    .with_expected(Bytes::from_slice(&env, b"valid CID"))
    .with_actual(json_cid.clone());

validator.validate_with_context(&env, &json_cid, context)?;

// Avoid: Generic errors without context
validator.validate(&env, &json_cid)?; // Less informative
```

### 4. Use Composition for Complex Validation

```rust
// Good: Combine validators for complex rules
let composed = ComposedValidator::all_validators()
    .add_validator(CIDValidator::new())
    .add_validator(HashValidator::sha256())
    .add_validator(BytesValidator::hex_only());

// Avoid: Manual complex validation logic
if cid_validator.validate(&env, &input).is_ok() && 
   hash_validator.validate(&env, &input).is_ok() {
   // Complex manual logic
}
```

## Testing

The framework includes comprehensive tests:

```bash
# Run validator tests (when cargo is available)
cargo test --package common-utils --lib validator

# Run specific validator tests
cargo test --package common-utils --lib validator::cid_validator
cargo test --package common-utils --lib validator::hash_validator
cargo test --package common-utils --lib validator::composed_validator
```

## Performance Considerations

1. **Validator Creation**: Validators are cheap to create and clone
2. **Configuration**: Configuration is applied at validation time
3. **Composition**: Minimal overhead for composed validators
4. **Memory**: Validators don't store validation state

## Future Enhancements

1. **Async Validation**: Support for asynchronous validation
2. **Caching**: Validation result caching for repeated validations
3. **Custom Error Types**: Contract-specific error types
4. **Validation Metrics**: Performance and usage metrics
5. **Dynamic Configuration**: Runtime configuration updates

## Conclusion

The Validator Framework provides a robust, flexible foundation for validation in Soroban contracts. It centralizes validation logic, improves maintainability, and provides rich error context while maintaining performance and type safety.

By adopting this framework, contracts can benefit from:
- Reduced code duplication
- Consistent validation behavior
- Better error reporting
- Easier testing and maintenance
- Configurable validation rules

The framework is designed to be extensible and can accommodate future validation requirements as the ecosystem evolves.
