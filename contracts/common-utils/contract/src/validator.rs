//! # Validator Framework
//!
//! A comprehensive validation framework for Soroban smart contracts.
//! Provides reusable validators with configurable bounds and composition support.

#![no_std]

use crate::error::{ErrorContext, ValidationError};
use core::str;
use soroban_sdk::{Address, Bytes, Env, String, Symbol, Val, Vec};

/// Core trait for all validators
pub trait Validator<T> {
    /// Validate the input and return an error if invalid
    fn validate(&self, env: &Env, input: &T) -> Result<(), ValidationError>;

    /// Validate with additional context
    fn validate_with_context(
        &self,
        env: &Env,
        input: &T,
        context: ErrorContext,
    ) -> Result<(), ValidationError> {
        match self.validate(env, input) {
            Ok(()) => Ok(()),
            Err(e) => Err(e),
        }
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
                .strict(false),
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
                   (97..=102).contains(&byte)
                {
                    // a-f
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
            Err(self
                .config
                .custom_error
                .unwrap_or(ValidationError::InvalidCidFormat))
        }
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
                        (97..=102).contains(&b) // a-f
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
                    // Basic UTF-8 validation (simplified)
                    core::str::from_utf8(bytes).is_ok()
                }
                BytesPattern::Custom(validator) => {
                    validator(bytes)
                }
                BytesPattern::Custom(validator) => validator(bytes),
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
