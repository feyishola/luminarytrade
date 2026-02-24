//! Metadata parser implementation
//! 
//! Extracts parsing logic from validation, making it reusable
//! across different contract types.

use soroban_sdk::{Bytes, Env, Vec};
use crate::error::ValidationError;
use super::traits::{Parser, ParseResult, ParserConfig};

/// Constants for CID validation
pub mod cid {
    pub const MAX_CID_LENGTH: usize = 100;
    pub const MIN_CID_LENGTH: usize = 10;
}

/// Constants for hash validation
pub mod hash {
    pub const MAX_HASH_LENGTH: usize = 128;
    pub const MIN_HASH_LENGTH: usize = 32;
}

/// Parsed metadata components
#[derive(Clone, Debug)]
pub struct ParsedMetadata {
    pub json_cid: Bytes,
    pub model_hash: Bytes,
    pub name: Bytes,
    pub description: Bytes,
    pub version: Bytes,
    pub extra_fields: Vec<(Bytes, Bytes)>,
}

/// Metadata parser that extracts parsing logic from validation
pub struct MetadataParser {
    config: ParserConfig,
}

impl MetadataParser {
    /// Create a new parser with default configuration
    pub fn new() -> Self {
        Self {
            config: ParserConfig::default(),
        }
    }
    
    /// Create a parser with custom configuration
    pub fn with_config(config: ParserConfig) -> Self {
        Self { config }
    }
    
    /// Parse CID from raw bytes
    pub fn parse_cid(&self, env: &Env, cid: &Bytes) -> ParseResult<Bytes> {
        let len = cid.len() as usize;
        
        // Check length constraints
        if len < cid::MIN_CID_LENGTH {
            return Err(ValidationError::InvalidLength);
        }
        
        if let Some(max_size) = self.config.max_size {
            if len > max_size.min(cid::MAX_CID_LENGTH) {
                return Err(ValidationError::InvalidLength);
            }
        } else if len > cid::MAX_CID_LENGTH {
            return Err(ValidationError::InvalidLength);
        }
        
        // Check for empty in strict mode
        if !self.config.allow_empty && cid.is_empty() {
            return Err(ValidationError::MissingRequiredField);
        }
        
        Ok(cid.clone())
    }
    
    /// Parse hash from raw bytes
    pub fn parse_hash(&self, env: &Env, hash: &Bytes) -> ParseResult<Bytes> {
        let len = hash.len() as usize;
        
        // Check length constraints
        if len < hash::MIN_HASH_LENGTH {
            return Err(ValidationError::InvalidHashFormat);
        }
        
        if let Some(max_size) = self.config.max_size {
            if len > max_size.min(hash::MAX_HASH_LENGTH) {
                return Err(ValidationError::InvalidHashFormat);
            }
        } else if len > hash::MAX_HASH_LENGTH {
            return Err(ValidationError::InvalidHashFormat);
        }
        
        // Check for empty in strict mode
        if !self.config.allow_empty && hash.is_empty() {
            return Err(ValidationError::MissingRequiredField);
        }
        
        Ok(hash.clone())
    }
    
    /// Parse a required text field
    pub fn parse_required_field(&self, env: &Env, field: &Bytes, field_name: &str) -> ParseResult<Bytes> {
        if !self.config.allow_empty && field.is_empty() {
            return Err(ValidationError::MissingRequiredField);
        }
        
        if let Some(max_size) = self.config.max_size {
            if field.len() as usize > max_size {
                return Err(ValidationError::InvalidLength);
            }
        }
        
        Ok(field.clone())
    }
    
    /// Parse optional extra fields
    pub fn parse_extra_fields(&self, env: &Env, fields: &Vec<(Bytes, Bytes)>) -> ParseResult<Vec<(Bytes, Bytes)>> {
        if self.config.strict {
            // In strict mode, validate each field
            for (key, value) in fields.iter() {
                if key.is_empty() {
                    return Err(ValidationError::InvalidFormat);
                }
                
                if let Some(max_size) = self.config.max_size {
                    if key.len() as usize > max_size || value.len() as usize > max_size {
                        return Err(ValidationError::InvalidLength);
                    }
                }
            }
        }
        
        Ok(fields.clone())
    }
    
    /// Parse complete metadata from components
    pub fn parse_metadata(
        &self,
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
        name: Bytes,
        description: Bytes,
        version: Bytes,
        extra_fields: Vec<(Bytes, Bytes)>,
    ) -> ParseResult<ParsedMetadata> {
        // Parse each component
        let parsed_cid = self.parse_cid(env, &json_cid)?;
        let parsed_hash = self.parse_hash(env, &model_hash)?;
        let parsed_name = self.parse_required_field(env, &name, "name")?;
        let parsed_description = self.parse_required_field(env, &description, "description")?;
        let parsed_version = self.parse_required_field(env, &version, "version")?;
        let parsed_extra = self.parse_extra_fields(env, &extra_fields)?;
        
        Ok(ParsedMetadata {
            json_cid: parsed_cid,
            model_hash: parsed_hash,
            name: parsed_name,
            description: parsed_description,
            version: parsed_version,
            extra_fields: parsed_extra,
        })
    }
}

impl Default for MetadataParser {
    fn default() -> Self {
        Self::new()
    }
}

// Implement Parser trait for Bytes input (simplified)
impl Parser<ParsedMetadata> for MetadataParser {
    fn parse(&self, env: &Env, input: &Bytes) -> ParseResult<ParsedMetadata> {
        // This is a simplified implementation
        // In a real scenario, you'd deserialize from the Bytes
        // For now, we'll return an error indicating this needs structured input
        Err(ValidationError::InvalidFormat)
    }
    
    fn parse_with_config(&self, env: &Env, input: &Bytes, config: &ParserConfig) -> ParseResult<ParsedMetadata> {
        let parser = Self::with_config(config.clone());
        parser.parse(env, input)
    }
    
    fn validate(&self, env: &Env, data: &ParsedMetadata) -> ParseResult<()> {
        if !self.config.custom_validation {
            return Ok(());
        }
        
        // Additional validation logic
        if self.config.strict {
            // Ensure all required fields are non-empty
            if data.name.is_empty() || data.description.is_empty() || data.version.is_empty() {
                return Err(ValidationError::MissingRequiredField);
            }
        }
        
        Ok(())
    }
}
