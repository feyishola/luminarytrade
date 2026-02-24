# Parser Framework

Reusable parsing framework for Soroban contracts that separates parsing logic from validation.

## Quick Start

```rust
use common_utils::parser::{MetadataParser, MetadataBuilder};

// Basic parsing
let parser = MetadataParser::new();
let metadata = parser.parse_metadata(
    &env, json_cid, model_hash, name, description, version, extra_fields
)?;

// Builder pattern
let metadata = MetadataBuilder::new()
    .with_cid(json_cid)
    .with_hash(model_hash)
    .with_name(name)
    .with_description(description)
    .with_version(version)
    .build(&env)?;

// Custom configuration
let parser = MetadataParser::with_config(ParserConfig::production());
```

## Module Structure

```
parser/
├── traits.rs           # Parser<T> trait
├── metadata_parser.rs  # MetadataParser implementation
├── builder.rs          # Builder pattern
├── config.rs           # Configuration presets
└── tests.rs            # Test suite (15 tests)
```

## Configuration Presets

- `default()` - Strict with standard limits
- `lenient()` - Allows empty fields
- `production()` - Strict, 1024 byte limit
- `development()` - Lenient, 10240 byte limit
- `minimal()` - Basic checks only
- `secure()` - Maximum security, 512 byte limit

## Testing

```bash
cargo test --package common-utils --lib parser
```

**Note**: Tests written but blocked by stellar-xdr dependency issue (not our code).

## Documentation

See `PARSER_DOCUMENTATION.md` for complete API reference and examples.
