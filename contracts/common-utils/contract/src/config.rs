use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone)]
pub struct Config {
    pub validation: ValidationConfig,
    pub security: SecurityConfig,
    pub performance: PerformanceConfig,
}

#[derive(Debug, Clone)]
pub struct ValidationConfig {
    pub max_cid_length: usize,
    pub min_cid_length: usize,
    pub max_hash_length: usize,
    pub min_hash_length: usize,
}

#[derive(Debug, Clone)]
pub struct SecurityConfig {
    pub timestamp_timeout: u64,
}

#[derive(Debug, Clone)]
pub struct PerformanceConfig {
    pub batch_size: usize,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            validation: ValidationConfig {
                max_cid_length: 100,
                min_cid_length: 10,
                max_hash_length: 128,
                min_hash_length: 32,
            },
            security: SecurityConfig {
                timestamp_timeout: 60,
            },
            performance: PerformanceConfig {
                batch_size: 500,
            },
        }
    }
}

pub struct ConfigManager {
    current: Arc<RwLock<Config>>,
}

impl ConfigManager {
    pub fn new() -> Self {
        Self {
            current: Arc::new(RwLock::new(Config::default())),
        }
    }

    pub fn get(&self) -> Config {
        self.current.read().unwrap().clone()
    }

    pub fn update(&self, new_config: Config) {
        *self.current.write().unwrap() = new_config;
        crate::logger::log_config_update(&new_config);
    }

    pub fn validate(&self) -> Result<(), String> {
        let cfg = self.get();
        if cfg.validation.min_cid_length > cfg.validation.max_cid_length {
            return Err("min_cid_length cannot exceed max_cid_length".into());
        }
        if cfg.validation.min_hash_length > cfg.validation.max_hash_length {
            return Err("min_hash_length cannot exceed max_hash_length".into());
        }
        Ok(())
    }
}