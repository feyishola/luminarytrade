# Parser Framework Documentation

## Overview

The parser framework provides a reusable, configurable system for parsing and validating metadata across different contract types. It separates parsing logic from validation concerns, making it easy to reuse and extend.

## Architecture

### Core Components

1. **Parser Trait** (`traits.rs`)
   - Generic interface for parsing operations
   - Defines `parse()`, `parse_with_config()`, and `validate()` methods
   - Type-safe with `ParseResult<T>` return type

2. **MetadataParser** (`metadata_parser.rs`)
   - Concrete implementation for metadata parsing
   - Handles CID, hash, and field parsing
   - Configurable validation rules

3. **Builder Pattern** (`builder.rs`)
   - Fluent API for constructing metadata
   - Automatic validation during build
   - Support for optional fields

4. **Configuration System** (`config.rs`)
   - Flexible parser behavior configuration
   - Preset configurations for common use cases
   - Builder pattern for custom configs

## Usage Examples

### Basic Parsing

```rust
use common_utils::parser::{MetadataParser, ParseResult};
use soroban_sdk::{Bytes, Env, Vec};

let env = Env::default();
let parser = MetadataParser::new();

let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
let name = Bytes::from_slice(&env, b"MyAgent");
let description = Bytes::from_slice(&env, b"Agent description");
let version = Bytes::from_slice(&env, b"1.0.0");
let extra_fields = Vec::new(&env);

let metadata = parser.parse_metadata(
    &env,
    json_cid,
    model_hash,
    name,
    description,
    version,
    extra_fields,
)?;
```

### Using the Builder Pattern

```rust
use common_utils::parser::MetadataBuilder;

let metadata = MetadataBuilder::new()
    .with_cid(json_cid)
    .with_hash(model_hash)
    .with_name(name)
    .with_description(description)
    .with_version(version)
    .add_extra_field(&env, key, value)
    .build(&env)?;
```

### Custom Configuration

```rust
use common_utils::parser::{MetadataParser, ParserConfig};

// Use preset configuration
let parser = MetadataParser::with_config(ParserConfig::lenient());

// Or build custom configuration
let config = ConfigBuilder::new()
    .strict(true)
    .max_size(512)
    .allow_empty(false)
    .custom_validation(true)
    .build();

let parser = MetadataParser::with_config(config);
```

### Configuration Presets

```rust
use common_utils::parser::config::ParserPresets;

// Default - strict with standard limits
let default_config = ParserPresets::default();

// Lenient - allows empty fields, no strict validation
let lenient_config = ParserPresets::lenient();

// Production - strict with reasonable limits
let prod_config = ParserPresets::production();

// Development - lenient for testing
let dev_config = ParserPresets::development();

// Secure - maximum security
let secure_config = ParserPresets::secure();
```

## Parsing Individual Components

### CID Parsing

```rust
let cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
let parsed_cid = parser.parse_cid(&env, &cid)?;
```

**Validation Rules:**
- Minimum length: 10 bytes
- Maximum length: 100 bytes (or custom limit)
- Cannot be empty in strict mode

### Hash Parsing

```rust
let hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
let parsed_hash = parser.parse_hash(&env, &hash)?;
```

**Validation Rules:**
- Minimum length: 32 bytes
- Maximum length: 128 bytes (or custom limit)
- Cannot be empty in strict mode

### Required Field Parsing

```rust
let field = Bytes::from_slice(&env, b"FieldValue");
let parsed_field = parser.parse_required_field(&env, &field, "field_name")?;
```

**Validation Rules:**
- Cannot be empty in strict mode
- Respects max_size configuration

## Error Handling

The parser uses `ValidationError` from the common error module:

```rust
pub enum ValidationError {
    InvalidLength,
    InvalidFormat,
    InvalidCidFormat,
    InvalidHashFormat,
    MissingRequiredField,
    InvalidJsonStructure,
}
```

## Extending the Parser

### Creating a Custom Parser

```rust
use common_utils::parser::{Parser, ParseResult, ParserConfig};

pub struct CustomParser {
    config: ParserConfig,
}

impl Parser<CustomType> for CustomParser {
    fn parse(&self, env: &Env, input: &Bytes) -> ParseResult<CustomType> {
        // Custom parsing logic
        Ok(CustomType { /* ... */ })
    }
    
    fn parse_with_config(&self, env: &Env, input: &Bytes, config: &ParserConfig) -> ParseResult<CustomType> {
        let parser = Self::with_config(config.clone());
        parser.parse(env, input)
    }
    
    fn validate(&self, env: &Env, data: &CustomType) -> ParseResult<()> {
        // Custom validation logic
        Ok(())
    }
}
```

## Integration with agent-metadata

The agent-metadata contract now uses the parser framework:

```rust
use common_utils::parser::{MetadataParser, MetadataBuilder};

// In your contract
pub fn validate_metadata(
    env: Env,
    json_cid: Bytes,
    model_hash: Bytes,
    name: Bytes,
    description: Bytes,
    version: Bytes,
) -> Result<AgentMetadata, MetadataError> {
    let parser = MetadataParser::new();
    let extra_fields = Vec::new(&env);
    
    let parsed = parser.parse_metadata(
        &env,
        json_cid,
        model_hash,
        name,
        description,
        version,
        extra_fields,
    )?;
    
    // Convert to your contract's type
    Ok(AgentMetadata::from(parsed))
}
```

## Testing

The parser includes comprehensive tests:

```bash
# Run all parser tests
cargo test --package common-utils --lib parser

# Run specific test module
cargo test --package common-utils --lib parser::tests

# Run with output
cargo test --package common-utils --lib parser -- --nocapture
```

## Best Practices

1. **Use Builder Pattern for Complex Objects**
   - Provides clear, readable code
   - Automatic validation
   - Type-safe construction

2. **Choose Appropriate Configuration**
   - Use `lenient()` for development/testing
   - Use `production()` or `secure()` for production
   - Create custom configs for specific needs

3. **Separate Parsing from Validation**
   - Parser handles data transformation
   - Validators handle business rules
   - Keep concerns separated

4. **Handle Errors Gracefully**
   - Use `ParseResult<T>` consistently
   - Map to contract-specific errors when needed
   - Provide meaningful error messages

5. **Reuse Across Contracts**
   - Import from common-utils
   - Extend with custom parsers
   - Share configuration presets

## Performance Considerations

- Parsing is lightweight and efficient
- Configuration is cloned, not referenced (small overhead)
- No dynamic allocations beyond Soroban SDK
- Suitable for on-chain execution

## Migration Guide

See `MIGRATION_GUIDE.md` for detailed instructions on migrating existing contracts to use the parser framework.
