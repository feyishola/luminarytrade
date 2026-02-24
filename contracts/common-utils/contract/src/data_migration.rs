#![no_std]

use soroban_sdk::{
    contracttype, Address, Env, Bytes, Vec, Symbol, Map, U256, 
    panic_with_error
};
use crate::error::ContractError;
use crate::compression::{
    CompressionType, CompressionMetadata, CompressionManager,
    FraudReportCompressor, FraudReport
};
use crate::storage_optimization::{
    DataTemperature, StorageMetadata, CompressedReportStorage
};

/// Migration status
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MigrationStatus {
    NotStarted,
    InProgress,
    Completed,
    Failed,
    RolledBack,
}

/// Migration configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct MigrationConfig {
    pub batch_size: u32,
    pub max_retries: u32,
    pub rollback_enabled: bool,
    pub validation_enabled: bool,
    pub compression_type: CompressionType,
    pub dry_run: bool,
}

/// Migration metadata
#[contracttype]
#[derive(Clone, Debug)]
pub struct MigrationMetadata {
    pub migration_id: u64,
    pub status: MigrationStatus,
    pub total_items: u32,
    pub processed_items: u32,
    pub failed_items: u32,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub original_size: u32,
    pub compressed_size: u32,
    pub compression_ratio: f32,
    pub error_message: Option<Symbol>,
}

/// Migration checkpoint for rollback support
#[contracttype]
#[derive(Clone, Debug)]
pub struct MigrationCheckpoint {
    pub checkpoint_id: u64,
    pub migration_id: u64,
    pub processed_items: u32,
    pub timestamp: u64,
    pub data_snapshot: Map<Symbol, Bytes>,
}

/// Data migration manager
pub struct DataMigrationManager;

impl DataMigrationManager {
    /// Start a new migration
    pub fn start_migration(
        env: &Env,
        config: &MigrationConfig,
        data_keys: &Vec<Symbol>,
    ) -> Result<u64, ContractError> {
        let migration_id = Self::generate_migration_id(env);
        
        let metadata = MigrationMetadata {
            migration_id,
            status: MigrationStatus::NotStarted,
            total_items: data_keys.len() as u32,
            processed_items: 0,
            failed_items: 0,
            start_time: env.ledger().timestamp(),
            end_time: None,
            original_size: 0,
            compressed_size: 0,
            compression_ratio: 0.0,
            error_message: None,
        };
        
        // Store migration metadata
        let metadata_key = Symbol::short(&format!("migration_meta_{}", migration_id));
        env.storage().instance().set(&metadata_key, &metadata);
        
        // Store configuration
        let config_key = Symbol::short(&format!("migration_config_{}", migration_id));
        env.storage().instance().set(&config_key, config);
        
        // Store data keys to migrate
        let keys_key = Symbol::short(&format!("migration_keys_{}", migration_id));
        env.storage().instance().set(&keys_key, data_keys);
        
        Ok(migration_id)
    }
    
    /// Execute migration
    pub fn execute_migration(
        env: &Env,
        migration_id: u64,
    ) -> Result<(), ContractError> {
        let metadata_key = Symbol::short(&format!("migration_meta_{}", migration_id));
        let mut metadata = env.storage().instance().get(&metadata_key)
            .ok_or(ContractError::NotFound)?;
        
        if metadata.status != MigrationStatus::NotStarted {
            return Err(ContractError::InvalidState);
        }
        
        // Update status to in progress
        metadata.status = MigrationStatus::InProgress;
        env.storage().instance().set(&metadata_key, &metadata);
        
        // Get configuration and data keys
        let config_key = Symbol::short(&format!("migration_config_{}", migration_id));
        let config = env.storage().instance().get(&config_key)
            .ok_or(ContractError::NotFound)?;
        
        let keys_key = Symbol::short(&format!("migration_keys_{}", migration_id));
        let data_keys = env.storage().instance().get(&keys_key)
            .ok_or(ContractError::NotFound)?;
        
        // Process data in batches
        let mut processed = 0;
        let mut failed = 0;
        let mut total_original_size = 0;
        let mut total_compressed_size = 0;
        
        for batch_start in (0..data_keys.len()).step_by(config.batch_size as usize) {
            let batch_end = (batch_start + config.batch_size as usize).min(data_keys.len());
            let batch = &data_keys[batch_start..batch_end];
            
            match Self::process_batch(env, migration_id, batch, &config) {
                Ok((batch_processed, batch_original_size, batch_compressed_size)) => {
                    processed += batch_processed;
                    total_original_size += batch_original_size;
                    total_compressed_size += batch_compressed_size;
                    
                    // Create checkpoint
                    if processed % (config.batch_size * 5) == 0 {
                        Self::create_checkpoint(env, migration_id, processed)?;
                    }
                }
                Err(e) => {
                    failed += batch.len() as u32;
                    
                    // Log error
                    env.events().publish(
                        (Symbol::short("migration_error"),),
                        (migration_id, batch_start as u32, e),
                    );
                    
                    if failed > config.max_retries {
                        metadata.status = MigrationStatus::Failed;
                        metadata.end_time = Some(env.ledger().timestamp());
                        metadata.error_message = Some(Symbol::short("max_retries_exceeded"));
                        env.storage().instance().set(&metadata_key, &metadata);
                        return Err(ContractError::MaxRetriesExceeded);
                    }
                }
            }
        }
        
        // Update final metadata
        metadata.status = MigrationStatus::Completed;
        metadata.processed_items = processed;
        metadata.failed_items = failed;
        metadata.end_time = Some(env.ledger().timestamp());
        metadata.original_size = total_original_size;
        metadata.compressed_size = total_compressed_size;
        metadata.compression_ratio = if total_original_size > 0 {
            total_compressed_size as f32 / total_original_size as f32
        } else {
            0.0
        };
        
        env.storage().instance().set(&metadata_key, &metadata);
        
        // Emit completion event
        env.events().publish(
            (Symbol::short("migration_completed"),),
            (migration_id, processed, failed, metadata.compression_ratio),
        );
        
        Ok(())
    }
    
    /// Process a batch of data items
    fn process_batch(
        env: &Env,
        migration_id: u64,
        data_keys: &Vec<Symbol>,
        config: &MigrationConfig,
    ) -> Result<(u32, u32, u32), ContractError> {
        let mut processed = 0;
        let mut original_size = 0;
        let mut compressed_size = 0;
        
        for data_key in data_keys.iter() {
            match Self::migrate_single_item(env, data_key, config) {
                Ok((orig, comp)) => {
                    processed += 1;
                    original_size += orig;
                    compressed_size += comp;
                }
                Err(e) => {
                    // Log individual item failure
                    env.events().publish(
                        (Symbol::short("item_migration_error"),),
                        (migration_id, data_key, e),
                    );
                }
            }
        }
        
        Ok((processed, original_size, compressed_size))
    }
    
    /// Migrate a single data item
    fn migrate_single_item(
        env: &Env,
        data_key: &Symbol,
        config: &MigrationConfig,
    ) -> Result<(u32, u32), ContractError> {
        // Get original data
        let original_data = env.storage().instance().get(data_key)
            .ok_or(ContractError::NotFound)?;
        
        let orig_size = original_data.len() as u32;
        
        // Skip if dry run
        if config.dry_run {
            let compressed_size = CompressionManager::compress(&original_data, &config.compression_type)?.len() as u32;
            return Ok((orig_size, compressed_size));
        }
        
        // Compress data
        let compressed_data = CompressionManager::compress(&original_data, &config.compression_type)?;
        let comp_size = compressed_data.len() as u32;
        
        // Validate compression if enabled
        if config.validation_enabled {
            let decompressed = CompressionManager::decompress(&compressed_data, &config.compression_type)?;
            if decompressed != original_data {
                return Err(ContractError::ValidationFailed);
            }
        }
        
        // Backup original data if rollback is enabled
        if config.rollback_enabled {
            let backup_key = Symbol::short(&format!("backup_{}", data_key));
            env.storage().temporary().set(&backup_key, &original_data);
        }
        
        // Store compressed data
        let compressed_key = Symbol::short(&format!("compressed_{}", data_key));
        env.storage().instance().set(&compressed_key, &compressed_data);
        
        // Remove original data
        env.storage().instance().remove(data_key);
        
        // Store compression metadata
        let metadata = CompressionMetadata {
            original_size: orig_size,
            compressed_size: comp_size,
            compression_type: config.compression_type.clone(),
            compression_ratio: CompressionManager::calculate_compression_ratio(orig_size, comp_size),
            timestamp: env.ledger().timestamp(),
        };
        
        let meta_key = Symbol::short(&format!("comp_meta_{}", data_key));
        env.storage().instance().set(&meta_key, &metadata);
        
        Ok((orig_size, comp_size))
    }
    
    /// Create migration checkpoint
    fn create_checkpoint(
        env: &Env,
        migration_id: u64,
        processed_items: u32,
    ) -> Result<(), ContractError> {
        let checkpoint_id = Self::generate_checkpoint_id(env);
        
        // Create data snapshot (simplified - in practice you'd capture more state)
        let data_snapshot = Map::new(&env);
        
        let checkpoint = MigrationCheckpoint {
            checkpoint_id,
            migration_id,
            processed_items,
            timestamp: env.ledger().timestamp(),
            data_snapshot,
        };
        
        let checkpoint_key = Symbol::short(&format!("checkpoint_{}", checkpoint_id));
        env.storage().instance().set(&checkpoint_key, &checkpoint);
        
        // Link checkpoint to migration
        let migration_checkpoints_key = Symbol::short(&format!("migration_checkpoints_{}", migration_id));
        let mut checkpoints = env.storage().instance().get(&migration_checkpoints_key)
            .unwrap_or_else(|| Vec::new(&env));
        checkpoints.push_back(checkpoint_id);
        env.storage().instance().set(&migration_checkpoints_key, &checkpoints);
        
        Ok(())
    }
    
    /// Rollback migration
    pub fn rollback_migration(
        env: &Env,
        migration_id: u64,
    ) -> Result<(), ContractError> {
        let metadata_key = Symbol::short(&format!("migration_meta_{}", migration_id));
        let mut metadata = env.storage().instance().get(&metadata_key)
            .ok_or(ContractError::NotFound)?;
        
        if metadata.status != MigrationStatus::Completed && metadata.status != MigrationStatus::Failed {
            return Err(ContractError::InvalidState);
        }
        
        // Get latest checkpoint
        let checkpoints_key = Symbol::short(&format!("migration_checkpoints_{}", migration_id));
        let checkpoints = env.storage().instance().get(&checkpoints_key)
            .ok_or(ContractError::NotFound)?;
        
        if checkpoints.is_empty() {
            return Err(ContractError::NotFound);
        }
        
        let latest_checkpoint_id = checkpoints.get(checkpoints.len() - 1).unwrap();
        let checkpoint_key = Symbol::short(&format!("checkpoint_{}", latest_checkpoint_id));
        let checkpoint = env.storage().instance().get(&checkpoint_key)
            .ok_or(ContractError::NotFound)?;
        
        // Restore data from backup
        let keys_key = Symbol::short(&format!("migration_keys_{}", migration_id));
        let data_keys = env.storage().instance().get(&keys_key)
            .ok_or(ContractError::NotFound)?;
        
        for data_key in data_keys.iter() {
            let backup_key = Symbol::short(&format!("backup_{}", data_key));
            if let Some(backup_data) = env.storage().temporary().get(&backup_key) {
                // Restore original data
                env.storage().instance().set(&data_key, &backup_data);
                
                // Remove compressed data
                let compressed_key = Symbol::short(&format!("compressed_{}", data_key));
                env.storage().instance().remove(&compressed_key);
                
                // Remove metadata
                let meta_key = Symbol::short(&format!("comp_meta_{}", data_key));
                env.storage().instance().remove(&meta_key);
                
                // Remove backup
                env.storage().temporary().remove(&backup_key);
            }
        }
        
        // Update metadata
        metadata.status = MigrationStatus::RolledBack;
        metadata.end_time = Some(env.ledger().timestamp());
        env.storage().instance().set(&metadata_key, &metadata);
        
        // Emit rollback event
        env.events().publish(
            (Symbol::short("migration_rolled_back"),),
            (migration_id, checkpoint.processed_items),
        );
        
        Ok(())
    }
    
    /// Validate migration results
    pub fn validate_migration(
        env: &Env,
        migration_id: u64,
    ) -> Result<bool, ContractError> {
        let metadata_key = Symbol::short(&format!("migration_meta_{}", migration_id));
        let metadata = env.storage().instance().get(&metadata_key)
            .ok_or(ContractError::NotFound)?;
        
        if metadata.status != MigrationStatus::Completed {
            return Ok(false);
        }
        
        // Get data keys
        let keys_key = Symbol::short(&format!("migration_keys_{}", migration_id));
        let data_keys = env.storage().instance().get(&keys_key)
            .ok_or(ContractError::NotFound)?;
        
        let mut valid_count = 0;
        
        for data_key in data_keys.iter() {
            if Self::validate_migrated_item(env, data_key)? {
                valid_count += 1;
            }
        }
        
        // Consider valid if 95% or more items are valid
        let validity_ratio = valid_count as f32 / data_keys.len() as f32;
        Ok(validity_ratio >= 0.95)
    }
    
    /// Validate a single migrated item
    fn validate_migrated_item(env: &Env, data_key: &Symbol) -> Result<bool, ContractError> {
        let compressed_key = Symbol::short(&format!("compressed_{}", data_key));
        let meta_key = Symbol::short(&format!("comp_meta_{}", data_key));
        
        let compressed_data = env.storage().instance().get(&compressed_key)
            .ok_or(ContractError::NotFound)?;
        let metadata = env.storage().instance().get(&meta_key)
            .ok_or(ContractError::NotFound)?;
        
        // Decompress and validate
        let decompressed = CompressionManager::decompress(&compressed_data, &metadata.compression_type)?;
        
        // Check size matches
        if decompressed.len() != metadata.original_size as usize {
            return Ok(false);
        }
        
        // Additional validation could be added here
        Ok(true)
    }
    
    /// Get migration status
    pub fn get_migration_status(env: &Env, migration_id: u64) -> Result<MigrationMetadata, ContractError> {
        let metadata_key = Symbol::short(&format!("migration_meta_{}", migration_id));
        env.storage().instance().get(&metadata_key)
            .ok_or(ContractError::NotFound)
    }
    
    /// List all migrations
    pub fn list_migrations(env: &Env) -> Result<Vec<u64>, ContractError> {
        // This is a simplified implementation
        // In practice, you'd maintain an index of all migrations
        Vec::new(&env)
    }
    
    /// Clean up migration data
    pub fn cleanup_migration(env: &Env, migration_id: u64) -> Result<(), ContractError> {
        let metadata_key = Symbol::short(&format!("migration_meta_{}", migration_id));
        let metadata = env.storage().instance().get(&metadata_key)
            .ok_or(ContractError::NotFound)?;
        
        // Only cleanup completed or failed migrations
        if metadata.status != MigrationStatus::Completed && metadata.status != MigrationStatus::Failed {
            return Err(ContractError::InvalidState);
        }
        
        // Remove all migration-related data
        env.storage().instance().remove(&metadata_key);
        
        let config_key = Symbol::short(&format!("migration_config_{}", migration_id));
        env.storage().instance().remove(&config_key);
        
        let keys_key = Symbol::short(&format!("migration_keys_{}", migration_id));
        env.storage().instance().remove(&keys_key);
        
        // Remove checkpoints
        let checkpoints_key = Symbol::short(&format!("migration_checkpoints_{}", migration_id));
        if let Some(checkpoints) = env.storage().instance().get(&checkpoints_key) {
            for checkpoint_id in checkpoints.iter() {
                let checkpoint_key = Symbol::short(&format!("checkpoint_{}", checkpoint_id));
                env.storage().instance().remove(&checkpoint_key);
            }
            env.storage().instance().remove(&checkpoints_key);
        }
        
        Ok(())
    }
    
    fn generate_migration_id(env: &Env) -> u64 {
        let counter_key = Symbol::short("migration_counter");
        let counter = env.storage().instance().get(&counter_key).unwrap_or(0);
        let new_counter = counter + 1;
        env.storage().instance().set(&counter_key, &new_counter);
        new_counter
    }
    
    fn generate_checkpoint_id(env: &Env) -> u64 {
        let counter_key = Symbol::short("checkpoint_counter");
        let counter = env.storage().instance().get(&counter_key).unwrap_or(0);
        let new_counter = counter + 1;
        env.storage().instance().set(&counter_key, &new_counter);
        new_counter
    }
}

/// Gradual migration for large datasets
pub struct GradualMigration;

impl GradualMigration {
    /// Start gradual migration
    pub fn start_gradual_migration(
        env: &Env,
        config: &MigrationConfig,
        data_keys: &Vec<Symbol>,
        batches_per_execution: u32,
    ) -> Result<u64, ContractError> {
        let migration_id = DataMigrationManager::start_migration(env, config, data_keys)?;
        
        // Store gradual migration config
        let gradual_config = GradualMigrationConfig {
            migration_id,
            total_batches: (data_keys.len() as u32 + config.batch_size - 1) / config.batch_size,
            completed_batches: 0,
            batches_per_execution,
            last_execution: 0,
        };
        
        let config_key = Symbol::short(&format!("gradual_config_{}", migration_id));
        env.storage().instance().set(&config_key, &gradual_config);
        
        Ok(migration_id)
    }
    
    /// Execute next batch of gradual migration
    pub fn execute_next_batch(env: &Env, migration_id: u64) -> Result<u32, ContractError> {
        let config_key = Symbol::short(&format!("gradual_config_{}", migration_id));
        let mut gradual_config = env.storage().instance().get(&config_key)
            .ok_or(ContractError::NotFound)?;
        
        if gradual_config.completed_batches >= gradual_config.total_batches {
            return Ok(0); // Migration complete
        }
        
        let batches_to_execute = gradual_config.batches_per_execution
            .min(gradual_config.total_batches - gradual_config.completed_batches);
        
        // Execute batches
        let mut executed = 0;
        for _ in 0..batches_to_execute {
            if Self::execute_single_batch(env, migration_id, gradual_config.completed_batches)? {
                executed += 1;
                gradual_config.completed_batches += 1;
            } else {
                break; // Stop on error
            }
        }
        
        // Update config
        gradual_config.last_execution = env.ledger().timestamp();
        env.storage().instance().set(&config_key, &gradual_config);
        
        Ok(executed)
    }
    
    fn execute_single_batch(
        env: &Env,
        migration_id: u64,
        batch_index: u32,
    ) -> Result<bool, ContractError> {
        // Get migration configuration
        let config_key = Symbol::short(&format!("migration_config_{}", migration_id));
        let config = env.storage().instance().get(&config_key)
            .ok_or(ContractError::NotFound)?;
        
        // Get data keys
        let keys_key = Symbol::short(&format!("migration_keys_{}", migration_id));
        let data_keys = env.storage().instance().get(&keys_key)
            .ok_or(ContractError::NotFound)?;
        
        // Calculate batch range
        let start = (batch_index * config.batch_size) as usize;
        let end = ((batch_index + 1) * config.batch_size) as usize;
        
        if start >= data_keys.len() {
            return Ok(false); // No more data
        }
        
        let batch = &data_keys[start..end.min(data_keys.len())];
        
        // Process batch
        match DataMigrationManager::process_batch(env, migration_id, &Vec::from_slice(&env, batch), &config) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

/// Gradual migration configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct GradualMigrationConfig {
    pub migration_id: u64,
    pub total_batches: u32,
    pub completed_batches: u32,
    pub batches_per_execution: u32,
    pub last_execution: u64,
}
