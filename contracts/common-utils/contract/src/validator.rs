//! # Validator Framework
//!
//! A comprehensive validation framework for Soroban smart contracts.
//! Provides reusable validators with configurable bounds and composition support.

#![no_std]

use soroban_sdk::{Bytes, Address, Env, Symbol};
use crate::error::{ValidationError, ErrorContext};

/// Core trait for all validators
pub trait Validator<T> {
    /// Validate the input and return an error if invalid
    fn validate(&self, env: &Env, input: &T) -> Result<(), ValidationError>;
    
    /// Validate with additional context
    fn validate_with_context(&self, env: &Env, input: &T, context: ErrorContext) -> Result<(), ValidationError> {
        match self.validate(env, input) {
            Ok(()) => Ok(()),
            Err(e) => Err(e)
        }
    }
    
    /// Get validator name for debugging
    fn name(&self) -> &'static str;
}

/// Configuration for validators
#[derive(Clone, Debug)]
pub struct ValidatorConfig {
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub allow_empty: bool,
    pub strict_mode: bool,
    pub custom_error: Option<ValidationError>,
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
    
    pub fn with_min_length(mut self, min: usize) -> Self {
        self.min_length = Some(min);
        self
    }
    
    pub fn with_max_length(mut self, max: usize) -> Self {
        self.max_length = Some(max);
        self
    }
    
    pub fn with_length_bounds(mut self, min: usize, max: usize) -> Self {
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
    
    pub fn with_custom_error(mut self, error: ValidationError) -> Self {
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
    
    pub fn with_config(config: ValidatorConfig) -> Self {
        Self { config }
    }
    
    pub fn lenient() -> Self {
        Self {
            config: ValidatorConfig::new()
                .with_length_bounds(5, 200)
                .strict(false)
                .allow_empty(false)
        }
    }
    
    pub fn strict() -> Self {
        Self {
            config: ValidatorConfig::new()
                .with_length_bounds(10, 100)
                .strict(true)
                .allow_empty(false)
        }
    }
    
    fn is_valid_cid_format(&self, bytes: &Bytes) -> bool {
        if self.config.allow_empty && bytes.is_empty() {
            return true;
        }
        
        if !self.config.allow_empty && bytes.is_empty() {
            return false;
        }
        
        let len = bytes.len() as usize;
        
        // Check length bounds
        if let Some(min) = self.config.min_length {
            if len < min {
                return false;
            }
        }
        
        if let Some(max) = self.config.max_length {
            if len > max {
                return false;
            }
        }
        
        // In strict mode, check for CID-like patterns
        if self.config.strict_mode {
            // Basic CID format checks (simplified for Soroban)
            // Real CID validation would be more complex
            let bytes_slice = bytes.to_array();
            
            // Check if it starts with common CID prefixes
            if bytes_slice.len() >= 2 {
                let prefix = &bytes_slice[..2];
                // Common CID version prefixes (simplified)
                if prefix == b"Qm" || prefix == b"ba" || prefix == b"z" {
                    return true;
                }
            }
            
            // For strict mode, require at least some hex-like characters
            let mut has_hex_chars = false;
            for &byte in &bytes_slice {
                if (48..=57).contains(&byte) ||      // 0-9
                   (65..=70).contains(&byte) ||      // A-F
                   (97..=102).contains(&byte) {      // a-f
                    has_hex_chars = true;
                    break;
                }
            }
            
            has_hex_chars
        } else {
            // Lenient mode - just check length
            true
        }
    }
}

impl Validator<Bytes> for CIDValidator {
    fn validate(&self, _env: &Env, input: &Bytes) -> Result<(), ValidationError> {
        if self.is_valid_cid_format(input) {
            Ok(())
        } else {
            Err(self.config.custom_error.unwrap_or(ValidationError::InvalidCidFormat))
        }
    }
    
    fn name(&self) -> &'static str {
        "CIDValidator"
    }
}

/// Hash validator with checksum support
#[derive(Clone, Debug)]
pub struct HashValidator {
    config: ValidatorConfig,
    algorithm: HashAlgorithm,
    verify_checksum: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub enum HashAlgorithm {
    SHA256,
    SHA512,
    Keccak256,
    MD5,
    Custom,
}

impl HashValidator {
    pub fn new() -> Self {
        Self {
            config: ValidatorConfig::new()
                .with_length_bounds(32, 128)
                .strict(false),
            algorithm: HashAlgorithm::SHA256,
            verify_checksum: false,
        }
    }
    
    pub fn with_config(config: ValidatorConfig) -> Self {
        Self {
            config,
            algorithm: HashAlgorithm::SHA256,
            verify_checksum: false,
        }
    }
    
    pub fn with_algorithm(mut self, algorithm: HashAlgorithm) -> Self {
        self.algorithm = algorithm;
        self
    }
    
    pub fn verify_checksum(mut self, verify: bool) -> Self {
        self.verify_checksum = verify;
        self
    }
    
    pub fn sha256() -> Self {
        Self::new()
            .with_algorithm(HashAlgorithm::SHA256)
            .with_config(ValidatorConfig::new().with_length_bounds(64, 64))
    }
    
    pub fn sha512() -> Self {
        Self::new()
            .with_algorithm(HashAlgorithm::SHA512)
            .with_config(ValidatorConfig::new().with_length_bounds(128, 128))
    }
    
    fn get_expected_length(&self) -> Option<usize> {
        match self.algorithm {
            HashAlgorithm::SHA256 => Some(64),  // 32 bytes * 2 hex chars
            HashAlgorithm::SHA512 => Some(128), // 64 bytes * 2 hex chars
            HashAlgorithm::Keccak256 => Some(64),
            HashAlgorithm::MD5 => Some(32),
            HashAlgorithm::Custom => None,
        }
    }
    
    fn is_valid_hash_format(&self, bytes: &Bytes) -> bool {
        if self.config.allow_empty && bytes.is_empty() {
            return true;
        }
        
        if !self.config.allow_empty && bytes.is_empty() {
            return false;
        }
        
        let len = bytes.len() as usize;
        
        // Check length bounds
        if let Some(min) = self.config.min_length {
            if len < min {
                return false;
            }
        }
        
        if let Some(max) = self.config.max_length {
            if len > max {
                return false;
            }
        }
        
        // Check algorithm-specific length
        if let Some(expected_len) = self.get_expected_length() {
            if self.config.strict_mode && len != expected_len {
                return false;
            }
        }
        
        // Validate hex characters
        if self.config.strict_mode {
            let bytes_slice = bytes.to_array();
            for &byte in &bytes_slice {
                if !((48..=57).contains(&byte) ||      // 0-9
                     (65..=70).contains(&byte) ||      // A-F
                     (97..=102).contains(&byte)) {     // a-f
                    return false;
                }
            }
        }
        
        true
    }
}

impl Validator<Bytes> for HashValidator {
    fn validate(&self, _env: &Env, input: &Bytes) -> Result<(), ValidationError> {
        if self.is_valid_hash_format(input) {
            Ok(())
        } else {
            Err(self.config.custom_error.unwrap_or(ValidationError::InvalidHashFormat))
        }
    }
    
    fn name(&self) -> &'static str {
        "HashValidator"
    }
}

/// General bytes validator
#[derive(Clone, Debug)]
pub struct BytesValidator {
    config: ValidatorConfig,
    allowed_patterns: Vec<BytesPattern>,
}

#[derive(Clone, Debug)]
pub enum BytesPattern {
    HexOnly,
    Base64,
    Utf8,
    Custom(fn(&[u8]) -> bool),
}

impl BytesValidator {
    pub fn new() -> Self {
        Self {
            config: ValidatorConfig::new(),
            allowed_patterns: Vec::new(),
        }
    }
    
    pub fn with_config(config: ValidatorConfig) -> Self {
        Self {
            config,
            allowed_patterns: Vec::new(),
        }
    }
    
    pub fn with_pattern(mut self, pattern: BytesPattern) -> Self {
        self.allowed_patterns.push(pattern);
        self
    }
    
    pub fn hex_only() -> Self {
        Self::new().with_pattern(BytesPattern::HexOnly)
    }
    
    pub fn base64() -> Self {
        Self::new().with_pattern(BytesPattern::Base64)
    }
    
    pub fn utf8() -> Self {
        Self::new().with_pattern(BytesPattern::Utf8)
    }
    
    fn matches_pattern(&self, bytes: &[u8]) -> bool {
        if self.allowed_patterns.is_empty() {
            return true; // No pattern restrictions
        }
        
        self.allowed_patterns.iter().any(|pattern| {
            match pattern {
                BytesPattern::HexOnly => {
                    bytes.iter().all(|&b| {
                        (48..=57).contains(&b) ||      // 0-9
                        (65..=70).contains(&b) ||      // A-F
                        (97..=102).contains(&b)        // a-f
                    })
                }
                BytesPattern::Base64 => {
                    bytes.iter().all(|&b| {
                        (48..=57).contains(&b) ||      // 0-9
                        (65..=90).contains(&b) ||      // A-Z
                        (97..=122).contains(&b) ||     // a-z
                        b == '+' || b == '/' || b == '='
                    })
                }
                BytesPattern::Utf8 => {
                    // Basic UTF-8 validation (simplified)
                    std::str::from_utf8(bytes).is_ok()
                }
                BytesPattern::Custom validator) => {
                    validator(bytes)
                }
            }
        })
    }
    
    fn is_valid_bytes(&self, bytes: &Bytes) -> bool {
        if self.config.allow_empty && bytes.is_empty() {
            return true;
        }
        
        if !self.config.allow_empty && bytes.is_empty() {
            return false;
        }
        
        let len = bytes.len() as usize;
        
        // Check length bounds
        if let Some(min) = self.config.min_length {
            if len < min {
                return false;
            }
        }
        
        if let Some(max) = self.config.max_length {
            if len > max {
                return false;
            }
        }
        
        // Check patterns
        self.matches_pattern(&bytes.to_array())
    }
}

impl Validator<Bytes> for BytesValidator {
    fn validate(&self, _env: &Env, input: &Bytes) -> Result<(), ValidationError> {
        if self.is_valid_bytes(input) {
            Ok(())
        } else {
            Err(self.config.custom_error.unwrap_or(ValidationError::InvalidFormat))
        }
    }
    
    fn name(&self) -> &'static str {
        "BytesValidator"
    }
}

/// Address validator
#[derive(Clone, Debug)]
pub struct AddressValidator {
    config: ValidatorConfig,
    allow_zero_address: bool,
}

impl AddressValidator {
    pub fn new() -> Self {
        Self {
            config: ValidatorConfig::new().allow_empty(false),
            allow_zero_address: false,
        }
    }
    
    pub fn with_config(config: ValidatorConfig) -> Self {
        Self {
            config,
            allow_zero_address: false,
        }
    }
    
    pub fn allow_zero(mut self, allow: bool) -> Self {
        self.allow_zero_address = allow;
        self
    }
    
    fn is_valid_address(&self, address: &Address) -> bool {
        if !self.allow_zero_address {
            // Check if it's not the zero address
            // This is a simplified check - in practice you'd want more sophisticated validation
            let env = Env::default();
            let zero_address = Address::from_string(&env, &soroban_sdk::String::from_str(&env, "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADO5"));
            address != &zero_address
        } else {
            true
        }
    }
}

impl Validator<Address> for AddressValidator {
    fn validate(&self, _env: &Env, input: &Address) -> Result<(), ValidationError> {
        if self.is_valid_address(input) {
            Ok(())
        } else {
            Err(self.config.custom_error.unwrap_or(ValidationError::InvalidAddress))
        }
    }
    
    fn name(&self) -> &'static str {
        "AddressValidator"
    }
}

/// Composed validator that combines multiple validators
#[derive(Clone, Debug)]
pub struct ComposedValidator<T> {
    validators: Vec<Box<dyn Validator<T>>>,
    mode: CompositionMode,
}

#[derive(Clone, Debug, PartialEq)]
pub enum CompositionMode {
    All,    // All validators must pass
    Any,    // Any validator can pass
    First,  // Use first validator that passes
}

impl<T> ComposedValidator<T> {
    pub fn new() -> Self {
        Self {
            validators: Vec::new(),
            mode: CompositionMode::All,
        }
    }
    
    pub fn with_mode(mut self, mode: CompositionMode) -> Self {
        self.mode = mode;
        self
    }
    
    pub fn add_validator<V: Validator<T> + 'static>(mut self, validator: V) -> Self {
        self.validators.push(Box::new(validator));
        self
    }
    
    pub fn all_validators() -> Self {
        Self::new().with_mode(CompositionMode::All)
    }
    
    pub fn any_validator() -> Self {
        Self::new().with_mode(CompositionMode::Any)
    }
    
    pub fn first_match() -> Self {
        Self::new().with_mode(CompositionMode::First)
    }
}

impl<T: Clone> Validator<T> for ComposedValidator<T> {
    fn validate(&self, env: &Env, input: &T) -> Result<(), ValidationError> {
        match self.mode {
            CompositionMode::All => {
                for validator in &self.validators {
                    validator.validate(env, input)?;
                }
                Ok(())
            }
            CompositionMode::Any => {
                let mut last_error = ValidationError::InvalidFormat;
                for validator in &self.validators {
                    match validator.validate(env, input) {
                        Ok(()) => return Ok(()),
                        Err(e) => last_error = e,
                    }
                }
                Err(last_error)
            }
            CompositionMode::First => {
                for validator in &self.validators {
                    if let Ok(()) = validator.validate(env, input) {
                        return Ok(());
                    }
                }
                Err(ValidationError::InvalidFormat)
            }
        }
    }
    
    fn name(&self) -> &'static str {
        "ComposedValidator"
    }
}

/// Validator registry for managing validators by name
pub struct ValidatorRegistry {
    env: Env,
}

impl ValidatorRegistry {
    pub fn new(env: &Env) -> Self {
        Self { env: env.clone() }
    }
    
    /// Register a validator with a name
    pub fn register<T: 'static>(&self, name: &str, validator: impl Validator<T> + 'static) {
        // In a real implementation, you'd store this in contract storage
        // For now, this is a placeholder for the registry concept
    }
    
    /// Get a validator by name
    pub fn get<T>(&self, name: &str) -> Option<Box<dyn Validator<T>>> {
        // In a real implementation, you'd retrieve from storage
        // For now, return None as placeholder
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Bytes;
    
    #[test]
    fn test_cid_validator() {
        let env = Env::default();
        let validator = CIDValidator::new();
        
        let valid_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let invalid_cid = Bytes::from_slice(&env, b"");
        
        assert!(validator.validate(&env, &valid_cid).is_ok());
        assert!(validator.validate(&env, &invalid_cid).is_err());
    }
    
    #[test]
    fn test_hash_validator() {
        let env = Env::default();
        let validator = HashValidator::sha256();
        
        let valid_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890");
        let invalid_hash = Bytes::from_slice(&env, b"short");
        
        assert!(validator.validate(&env, &valid_hash).is_ok());
        assert!(validator.validate(&env, &invalid_hash).is_err());
    }
    
    #[test]
    fn test_composed_validator() {
        let env = Env::default();
        let cid_validator = CIDValidator::new();
        let hash_validator = HashValidator::sha256();
        
        let composed = ComposedValidator::all_validators()
            .add_validator(cid_validator)
            .add_validator(hash_validator);
        
        let valid_data = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        assert!(composed.validate(&env, &valid_data).is_ok());
    }
}
