//! Core parser traits and types

use soroban_sdk::{Bytes, Env};
use crate::error::ValidationError;

/// Result type for parsing operations
pub type ParseResult<T> = Result<T, ValidationError>;

/// Generic parser trait for converting raw data into structured types
/// 
/// This trait separates parsing logic from validation, allowing
/// validators to focus on business rules while parsers handle
/// data transformation.
pub trait Parser<T> {
    /// Parse raw input into a structured type
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `input` - Raw input data
    /// 
    /// # Returns
    /// * `Ok(T)` - Successfully parsed data
    /// * `Err(ValidationError)` - Parsing failed
    fn parse(&self, env: &Env, input: &Bytes) -> ParseResult<T>;
    
    /// Parse with custom configuration
    fn parse_with_config(&self, env: &Env, input: &Bytes, config: &ParserConfig) -> ParseResult<T>;
    
    /// Validate parsed data (optional, can be overridden)
    fn validate(&self, _env: &Env, _data: &T) -> ParseResult<()> {
        Ok(())
    }
}

/// Configuration for parser behavior
#[derive(Clone, Debug)]
pub struct ParserConfig {
    /// Strict mode - fail on any warnings
    pub strict: bool,
    /// Maximum allowed size for parsed data
    pub max_size: Option<usize>,
    /// Allow empty fields
    pub allow_empty: bool,
    /// Custom validation rules enabled
    pub custom_validation: bool,
}

impl Default for ParserConfig {
    fn default() -> Self {
        Self {
            strict: true,
            max_size: None,
            allow_empty: false,
            custom_validation: true,
        }
    }
}

impl ParserConfig {
    /// Create a lenient configuration
    pub fn lenient() -> Self {
        Self {
            strict: false,
            max_size: None,
            allow_empty: true,
            custom_validation: false,
        }
    }
    
    /// Create a strict configuration with size limits
    pub fn strict_with_limits(max_size: usize) -> Self {
        Self {
            strict: true,
            max_size: Some(max_size),
            allow_empty: false,
            custom_validation: true,
        }
    }
}
