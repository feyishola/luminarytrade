//! Builder pattern for constructing complex metadata objects
//! 
//! Provides a fluent API for building metadata with validation

use soroban_sdk::{Bytes, Env, Vec};
use crate::error::ValidationError;
use super::metadata_parser::{ParsedMetadata, MetadataParser};
use super::traits::{ParseResult, ParserConfig};

/// Builder for constructing metadata objects with validation
pub struct MetadataBuilder {
    json_cid: Option<Bytes>,
    model_hash: Option<Bytes>,
    name: Option<Bytes>,
    description: Option<Bytes>,
    version: Option<Bytes>,
    extra_fields: Option<Vec<(Bytes, Bytes)>>,
    parser_config: ParserConfig,
}

impl MetadataBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            json_cid: None,
            model_hash: None,
            name: None,
            description: None,
            version: None,
            extra_fields: None,
            parser_config: ParserConfig::default(),
        }
    }
    
    /// Set the JSON CID
    pub fn with_cid(mut self, cid: Bytes) -> Self {
        self.json_cid = Some(cid);
        self
    }
    
    /// Set the model hash
    pub fn with_hash(mut self, hash: Bytes) -> Self {
        self.model_hash = Some(hash);
        self
    }
    
    /// Set the name
    pub fn with_name(mut self, name: Bytes) -> Self {
        self.name = Some(name);
        self
    }
    
    /// Set the description
    pub fn with_description(mut self, description: Bytes) -> Self {
        self.description = Some(description);
        self
    }
    
    /// Set the version
    pub fn with_version(mut self, version: Bytes) -> Self {
        self.version = Some(version);
        self
    }
    
    /// Set extra fields
    pub fn with_extra_fields(mut self, fields: Vec<(Bytes, Bytes)>) -> Self {
        self.extra_fields = Some(fields);
        self
    }
    
    /// Add a single extra field
    pub fn add_extra_field(mut self, env: &Env, key: Bytes, value: Bytes) -> Self {
        if self.extra_fields.is_none() {
            self.extra_fields = Some(Vec::new(env));
        }
        
        if let Some(ref mut fields) = self.extra_fields {
            fields.push_back((key, value));
        }
        
        self
    }
    
    /// Set parser configuration
    pub fn with_config(mut self, config: ParserConfig) -> Self {
        self.parser_config = config;
        self
    }
    
    /// Use lenient parsing
    pub fn lenient(mut self) -> Self {
        self.parser_config = ParserConfig::lenient();
        self
    }
    
    /// Use strict parsing with size limits
    pub fn strict_with_limits(mut self, max_size: usize) -> Self {
        self.parser_config = ParserConfig::strict_with_limits(max_size);
        self
    }
    
    /// Build and validate the metadata
    pub fn build(self, env: &Env) -> ParseResult<ParsedMetadata> {
        // Check required fields
        let json_cid = self.json_cid.ok_or(ValidationError::MissingRequiredField)?;
        let model_hash = self.model_hash.ok_or(ValidationError::MissingRequiredField)?;
        let name = self.name.ok_or(ValidationError::MissingRequiredField)?;
        let description = self.description.ok_or(ValidationError::MissingRequiredField)?;
        let version = self.version.ok_or(ValidationError::MissingRequiredField)?;
        let extra_fields = self.extra_fields.unwrap_or_else(|| Vec::new(env));
        
        // Use parser to validate and parse
        let parser = MetadataParser::with_config(self.parser_config);
        let metadata = parser.parse_metadata(
            env,
            json_cid,
            model_hash,
            name,
            description,
            version,
            extra_fields,
        )?;
        
        // Run additional validation
        parser.validate(env, &metadata)?;
        
        Ok(metadata)
    }
    
    /// Build without validation (use with caution)
    pub fn build_unchecked(self, env: &Env) -> ParseResult<ParsedMetadata> {
        let json_cid = self.json_cid.ok_or(ValidationError::MissingRequiredField)?;
        let model_hash = self.model_hash.ok_or(ValidationError::MissingRequiredField)?;
        let name = self.name.ok_or(ValidationError::MissingRequiredField)?;
        let description = self.description.ok_or(ValidationError::MissingRequiredField)?;
        let version = self.version.ok_or(ValidationError::MissingRequiredField)?;
        let extra_fields = self.extra_fields.unwrap_or_else(|| Vec::new(env));
        
        Ok(ParsedMetadata {
            json_cid,
            model_hash,
            name,
            description,
            version,
            extra_fields,
        })
    }
}

impl Default for MetadataBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience function to create a builder
pub fn metadata() -> MetadataBuilder {
    MetadataBuilder::new()
}
