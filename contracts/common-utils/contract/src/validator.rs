//! # Validator Framework
//!
//! A comprehensive validation framework for Soroban smart contracts.
//! Provides reusable validators with configurable bounds and composition support.

use soroban_sdk::{Bytes, Address, Env};
use crate::error::{CommonError, ErrorContext};

/// Core trait for all validators
pub trait Validator<T> {
    /// Validate the input and return an error if invalid
    fn validate(&self, env: &Env, input: &T) -> Result<(), CommonError>;
    
    /// Validate with additional context
    fn validate_with_context(&self, env: &Env, input: &T, _context: ErrorContext) -> Result<(), CommonError> {
        self.validate(env, input)
    }
    
    /// Get validator name for debugging
    fn name(&self) -> &'static str;
}

/// Configuration for validators
#[derive(Clone, Debug)]
pub struct ValidatorConfig {
    pub min_length: Option<u32>,
    pub max_length: Option<u32>,
    pub allow_empty: bool,
    pub strict_mode: bool,
    pub custom_error: Option<CommonError>,
}

impl Default for ValidatorConfig {
    fn default() -> Self {
        Self {
            min_length: None,
            max_length: None,
            allow_empty: false,
            strict_mode: false,
            custom_error: None,
        }
    }
}

impl ValidatorConfig {
    pub fn new() -> Self {
        Self::default()
    }
    
    pub fn with_min_length(mut self, min: u32) -> Self {
        self.min_length = Some(min);
        self
    }
    
    pub fn with_max_length(mut self, max: u32) -> Self {
        self.max_length = Some(max);
        self
    }
    
    pub fn with_length_bounds(mut self, min: u32, max: u32) -> Self {
        self.min_length = Some(min);
        self.max_length = Some(max);
        self
    }
    
    pub fn allow_empty(mut self, allow: bool) -> Self {
        self.allow_empty = allow;
        self
    }
    
    pub fn strict(mut self, strict: bool) -> Self {
        self.strict_mode = strict;
        self
    }
    
    pub fn with_custom_error(mut self, error: CommonError) -> Self {
        self.custom_error = Some(error);
        self
    }
}

/// CID validator with configurable bounds
#[derive(Clone, Debug)]
pub struct CIDValidator {
    config: ValidatorConfig,
}

impl CIDValidator {
    pub fn new() -> Self {
        Self {
            config: ValidatorConfig::new()
                .with_length_bounds(10, 100)
                .strict(false)
        }
    }
}

impl Validator<Bytes> for CIDValidator {
    fn validate(&self, _env: &Env, input: &Bytes) -> Result<(), CommonError> {
        let len = input.len();
        
        if len == 0 {
            if self.config.allow_empty {
                return Ok(());
            } else {
                return Err(self.config.custom_error.clone().unwrap_or(CommonError::InvalidFormat));
            }
        }
        
        if let Some(min) = self.config.min_length {
            if len < min { return Err(self.config.custom_error.clone().unwrap_or(CommonError::InvalidFormat)); }
        }
        
        if let Some(max) = self.config.max_length {
            if len > max { return Err(self.config.custom_error.clone().unwrap_or(CommonError::InvalidFormat)); }
        }
        
        Ok(())
    }
    
    fn name(&self) -> &'static str {
        "CIDValidator"
    }
}

/// Hash validator
#[derive(Clone, Debug, PartialEq)]
pub enum HashAlgorithm {
    SHA256,
}

#[derive(Clone, Debug)]
pub struct HashValidator {
    _config: ValidatorConfig,
    _algorithm: HashAlgorithm,
}

impl HashValidator {
    pub fn sha256() -> Self {
        Self {
            _config: ValidatorConfig::new().with_length_bounds(32, 64),
            _algorithm: HashAlgorithm::SHA256,
        }
    }
}

impl Validator<Bytes> for HashValidator {
    fn validate(&self, _env: &Env, input: &Bytes) -> Result<(), CommonError> {
        let len = input.len();
        if len >= 32 && len <= 64 {
            Ok(())
        } else {
            Err(CommonError::InvalidFormat)
        }
    }
    
    fn name(&self) -> &'static str {
        "HashValidator"
    }
}

/// Address validator
#[derive(Clone, Debug)]
pub struct AddressValidator {
    _config: ValidatorConfig,
}

impl AddressValidator {
    pub fn new() -> Self {
        Self {
            _config: ValidatorConfig::new().allow_empty(false),
        }
    }
}

impl Validator<Address> for AddressValidator {
    fn validate(&self, _env: &Env, _input: &Address) -> Result<(), CommonError> {
        Ok(())
    }
    
    fn name(&self) -> &'static str {
        "AddressValidator"
    }
}
