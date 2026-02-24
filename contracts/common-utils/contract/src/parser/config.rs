//! Parser configuration system
//! 
//! Provides flexible configuration for parsing behavior

/// Re-export ParserConfig from traits
pub use super::traits::ParserConfig;

/// Preset configurations for common use cases
pub struct ParserPresets;

impl ParserPresets {
    /// Default configuration - strict with standard limits
    pub fn default() -> ParserConfig {
        ParserConfig::default()
    }
    
    /// Lenient configuration - allows empty fields, no strict validation
    pub fn lenient() -> ParserConfig {
        ParserConfig::lenient()
    }
    
    /// Production configuration - strict with reasonable limits
    pub fn production() -> ParserConfig {
        ParserConfig::strict_with_limits(1024)
    }
    
    /// Development configuration - lenient for testing
    pub fn development() -> ParserConfig {
        ParserConfig {
            strict: false,
            max_size: Some(10240), // Larger limit for dev
            allow_empty: true,
            custom_validation: false,
        }
    }
    
    /// Minimal configuration - only basic checks
    pub fn minimal() -> ParserConfig {
        ParserConfig {
            strict: false,
            max_size: None,
            allow_empty: true,
            custom_validation: false,
        }
    }
    
    /// Maximum security configuration
    pub fn secure() -> ParserConfig {
        ParserConfig {
            strict: true,
            max_size: Some(512), // Tight limit
            allow_empty: false,
            custom_validation: true,
        }
    }
}

/// Builder for custom parser configurations
pub struct ConfigBuilder {
    config: ParserConfig,
}

impl ConfigBuilder {
    /// Create a new configuration builder
    pub fn new() -> Self {
        Self {
            config: ParserConfig::default(),
        }
    }
    
    /// Start from a preset
    pub fn from_preset(preset: ParserConfig) -> Self {
        Self { config: preset }
    }
    
    /// Set strict mode
    pub fn strict(mut self, strict: bool) -> Self {
        self.config.strict = strict;
        self
    }
    
    /// Set maximum size
    pub fn max_size(mut self, size: usize) -> Self {
        self.config.max_size = Some(size);
        self
    }
    
    /// Remove size limit
    pub fn no_size_limit(mut self) -> Self {
        self.config.max_size = None;
        self
    }
    
    /// Allow empty fields
    pub fn allow_empty(mut self, allow: bool) -> Self {
        self.config.allow_empty = allow;
        self
    }
    
    /// Enable custom validation
    pub fn custom_validation(mut self, enable: bool) -> Self {
        self.config.custom_validation = enable;
        self
    }
    
    /// Build the configuration
    pub fn build(self) -> ParserConfig {
        self.config
    }
}

impl Default for ConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}
