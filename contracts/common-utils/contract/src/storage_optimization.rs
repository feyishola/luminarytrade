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

/// Data temperature for hot/cold separation
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DataTemperature {
    Hot,    // Frequently accessed data
    Warm,   // Moderately accessed data
    Cold,   // Rarely accessed data
    Frozen, // Archived data
}

/// Storage tier configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct StorageTier {
    pub temperature: DataTemperature,
    pub retention_period: u64, // seconds
    pub max_size: u32,         // maximum size in bytes
    pub compression_type: CompressionType,
}

/// Data archiving configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct ArchiveConfig {
    pub archive_after: u64,     // seconds after which data is archived
    pub delete_after: u64,      // seconds after which data is deleted
    pub compression_threshold: f32, // compress if ratio > threshold
    pub batch_size: u32,        // number of items to archive at once
}

/// Bloom filter for quick existence checks
#[contracttype]
#[derive(Clone)]
pub struct BloomFilter {
    pub bit_array: Bytes,
    pub hash_count: u32,
    pub size: u32,
    pub item_count: u32,
}

impl BloomFilter {
    /// Create a new bloom filter
    pub fn new(env: &Env, size: u32, hash_count: u32) -> Self {
        let bit_array = Bytes::from_slice(env, &vec![0u8; (size / 8) as usize]);
        Self {
            bit_array,
            hash_count,
            size,
            item_count: 0,
        }
    }
    
    /// Add an item to the bloom filter
    pub fn add(&mut self, env: &Env, item: &Bytes) {
        for i in 0..self.hash_count {
            let hash = self.hash(item, i);
            let bit_index = (hash % self.size) as usize;
            let byte_index = bit_index / 8;
            let bit_offset = bit_index % 8;
            
            let mut bit_array = self.bit_array.to_array();
            if byte_index < bit_array.len() {
                bit_array[byte_index] |= 1 << bit_offset;
                self.bit_array = Bytes::from_slice(env, &bit_array);
            }
        }
        self.item_count += 1;
    }
    
    /// Check if an item might exist in the bloom filter
    pub fn might_contain(&self, item: &Bytes) -> bool {
        for i in 0..self.hash_count {
            let hash = self.hash(item, i);
            let bit_index = (hash % self.size) as usize;
            let byte_index = bit_index / 8;
            let bit_offset = bit_index % 8;
            
            let bit_array = self.bit_array.to_array();
            if byte_index >= bit_array.len() {
                return false;
            }
            
            if (bit_array[byte_index] & (1 << bit_offset)) == 0 {
                return false;
            }
        }
        true
    }
    
    /// Simple hash function for bloom filter
    fn hash(&self, item: &Bytes, seed: u32) -> u32 {
        let mut hash = seed;
        for byte in item.to_array() {
            hash = hash.wrapping_mul(31).wrapping_add(byte as u32);
        }
        hash
    }
    
    /// Get false positive probability estimate
    pub fn false_positive_rate(&self) -> f32 {
        if self.item_count == 0 { return 0.0; }
        let k = self.hash_count as f32;
        let n = self.item_count as f32;
        let m = self.size as f32;
        
        (1.0 - (-k * n / m).exp()).powf(k)
    }
}

/// Hot/cold data separator
pub struct DataSeparator;

impl DataSeparator {
    /// Determine data temperature based on access patterns
    pub fn classify_data(
        env: &Env,
        data_key: &Symbol,
        access_count: u32,
        last_access: u64,
    ) -> DataTemperature {
        let now = env.ledger().timestamp();
        let time_since_access = now - last_access;
        
        // Classification logic
        if time_since_access < 3600 && access_count > 10 {
            // Accessed within last hour and more than 10 times
            DataTemperature::Hot
        } else if time_since_access < 86400 && access_count > 5 {
            // Accessed within last day and more than 5 times
            DataTemperature::Warm
        } else if time_since_access < 604800 {
            // Accessed within last week
            DataTemperature::Cold
        } else {
            // Not accessed in over a week
            DataTemperature::Frozen
        }
    }
    
    /// Move data between storage tiers
    pub fn move_to_tier(
        env: &Env,
        data_key: &Symbol,
        from_tier: DataTemperature,
        to_tier: DataTemperature,
        data: &Bytes,
    ) -> Result<(), ContractError> {
        // Remove from source tier
        let source_key = Self::get_tier_key(data_key, &from_tier);
        env.storage().instance().remove(&source_key);
        
        // Add to destination tier (with compression if needed)
        let dest_key = Self::get_tier_key(data_key, &to_tier);
        let tier_config = Self::get_tier_config(env, &to_tier);
        
        let final_data = if tier_config.compression_type != CompressionType::None {
            CompressionManager::compress(data, &tier_config.compression_type)?
        } else {
            data.clone()
        };
        
        env.storage().instance().set(&dest_key, &final_data);
        
        // Update metadata
        Self::update_metadata(env, data_key, &to_tier, final_data.len() as u32);
        
        Ok(())
    }
    
    fn get_tier_key(data_key: &Symbol, tier: &DataTemperature) -> Symbol {
        let tier_str = match tier {
            DataTemperature::Hot => "hot",
            DataTemperature::Warm => "warm",
            DataTemperature::Cold => "cold",
            DataTemperature::Frozen => "frozen",
        };
        Symbol::short(&format!("{}_{}", data_key, tier_str))
    }
    
    fn get_tier_config(env: &Env, tier: &DataTemperature) -> StorageTier {
        let config_key = match tier {
            DataTemperature::Hot => Symbol::short("hot_tier"),
            DataTemperature::Warm => Symbol::short("warm_tier"),
            DataTemperature::Cold => Symbol::short("cold_tier"),
            DataTemperature::Frozen => Symbol::short("frozen_tier"),
        };
        
        env.storage()
            .instance()
            .get(&config_key)
            .unwrap_or_else(|| Self::default_tier_config(tier))
    }
    
    fn default_tier_config(tier: &DataTemperature) -> StorageTier {
        match tier {
            DataTemperature::Hot => StorageTier {
                temperature: DataTemperature::Hot,
                retention_period: 3600,        // 1 hour
                max_size: 1024 * 1024,       // 1MB
                compression_type: CompressionType::None,
            },
            DataTemperature::Warm => StorageTier {
                temperature: DataTemperature::Warm,
                retention_period: 86400,       // 1 day
                max_size: 5 * 1024 * 1024,   // 5MB
                compression_type: CompressionType::BitPacking,
            },
            DataTemperature::Cold => StorageTier {
                temperature: DataTemperature::Cold,
                retention_period: 604800,      // 1 week
                max_size: 50 * 1024 * 1024,  // 50MB
                compression_type: CompressionType::DeltaEncoding,
            },
            DataTemperature::Frozen => StorageTier {
                temperature: DataTemperature::Frozen,
                retention_period: 2592000,     // 30 days
                max_size: 100 * 1024 * 1024, // 100MB
                compression_type: CompressionType::DeltaEncoding,
            },
        }
    }
    
    fn update_metadata(
        env: &Env,
        data_key: &Symbol,
        tier: &DataTemperature,
        size: u32,
    ) {
        let metadata_key = Symbol::short(&format!("metadata_{}", data_key));
        let metadata = StorageMetadata {
            data_key: data_key.clone(),
            tier: tier.clone(),
            size,
            last_access: env.ledger().timestamp(),
            compression_type: Self::get_tier_config(env, tier).compression_type,
        };
        
        env.storage().instance().set(&metadata_key, &metadata);
    }
}

/// Storage metadata for tracking data
#[contracttype]
#[derive(Clone, Debug)]
pub struct StorageMetadata {
    pub data_key: Symbol,
    pub tier: DataTemperature,
    pub size: u32,
    pub last_access: u64,
    pub compression_type: CompressionType,
}

/// Automatic data archiver
pub struct DataArchiver;

impl DataArchiver {
    /// Archive old data based on configuration
    pub fn archive_old_data(env: &Env, config: &ArchiveConfig) -> Result<u32, ContractError> {
        let now = env.ledger().timestamp();
        let mut archived_count = 0;
        
        // Get all data keys that need archiving
        let data_keys = Self::get_data_keys_for_archival(env, now, config.archive_after);
        
        for data_key in data_keys.iter() {
            if archived_count >= config.batch_size {
                break;
            }
            
            if let Err(e) = Self::archive_single_data(env, data_key, config) {
                // Log error but continue with other items
                env.events().publish(
                    (Symbol::short("archive_error"),),
                    (data_key, e),
                );
            } else {
                archived_count += 1;
            }
        }
        
        Ok(archived_count)
    }
    
    /// Archive a single data item
    fn archive_single_data(
        env: &Env,
        data_key: &Symbol,
        config: &ArchiveConfig,
    ) -> Result<(), ContractError> {
        // Get current data
        let current_data = env.storage().instance().get(data_key)
            .ok_or(ContractError::NotFound)?;
        
        // Check if compression is beneficial
        let compressed_data = CompressionManager::compress(&current_data, &CompressionType::DeltaEncoding)?;
        let compression_ratio = CompressionManager::calculate_compression_ratio(
            current_data.len() as u32,
            compressed_data.len() as u32,
        );
        
        let final_data = if compression_ratio < config.compression_threshold {
            compressed_data
        } else {
            current_data
        };
        
        // Move to archive storage
        let archive_key = Symbol::short(&format!("archive_{}", data_key));
        env.storage().instance().set(&archive_key, &final_data);
        
        // Remove from main storage
        env.storage().instance().remove(data_key);
        
        // Update metadata
        let metadata = ArchiveMetadata {
            original_key: data_key.clone(),
            archive_key,
            archived_at: env.ledger().timestamp(),
            original_size: current_data.len() as u32,
            compressed_size: final_data.len() as u32,
            compression_ratio,
        };
        
        let metadata_key = Symbol::short(&format!("archive_meta_{}", data_key));
        env.storage().instance().set(&metadata_key, &metadata);
        
        Ok(())
    }
    
    /// Get data keys that need archival
    fn get_data_keys_for_archival(
        env: &Env,
        current_time: u64,
        archive_after: u64,
    ) -> Vec<Symbol> {
        // This is a simplified implementation
        // In practice, you'd maintain an index of all data keys with timestamps
        Vec::new(&env)
    }
    
    /// Delete expired archived data
    pub fn cleanup_expired_data(env: &Env, config: &ArchiveConfig) -> Result<u32, ContractError> {
        let now = env.ledger().timestamp();
        let mut deleted_count = 0;
        
        // Get all archive metadata
        let archive_keys = Self::get_expired_archive_keys(env, now, config.delete_after);
        
        for archive_key in archive_keys.iter() {
            // Remove archived data
            env.storage().instance().remove(archive_key);
            
            // Remove metadata
            let metadata_key = Symbol::short(&format!("archive_meta_{}", archive_key));
            env.storage().instance().remove(&metadata_key);
            
            deleted_count += 1;
        }
        
        Ok(deleted_count)
    }
    
    fn get_expired_archive_keys(
        env: &Env,
        current_time: u64,
        delete_after: u64,
    ) -> Vec<Symbol> {
        // Simplified implementation
        Vec::new(&env)
    }
}

/// Archive metadata
#[contracttype]
#[derive(Clone, Debug)]
pub struct ArchiveMetadata {
    pub original_key: Symbol,
    pub archive_key: Symbol,
    pub archived_at: u64,
    pub original_size: u32,
    pub compressed_size: u32,
    pub compression_ratio: f32,
}

/// Compressed report storage
pub struct CompressedReportStorage;

impl CompressedReportStorage {
    /// Store compressed fraud reports
    pub fn store_reports(
        env: &Env,
        agent_id: &Symbol,
        reports: &Vec<FraudReport>,
    ) -> Result<(), ContractError> {
        // Compress reports
        let compressed_data = FraudReportCompressor::compress_reports(reports)?;
        
        // Store with metadata
        let storage_key = Symbol::short(&format!("reports_{}", agent_id));
        let metadata_key = Symbol::short(&format!("reports_meta_{}", agent_id));
        
        env.storage().instance().set(&storage_key, &compressed_data);
        
        let metadata = ReportStorageMetadata {
            agent_id: agent_id.clone(),
            report_count: reports.len() as u32,
            original_size: Self::calculate_original_size(reports),
            compressed_size: compressed_data.len() as u32,
            compression_ratio: compressed_data.len() as f32 / Self::calculate_original_size(reports) as f32,
            last_updated: env.ledger().timestamp(),
        };
        
        env.storage().instance().set(&metadata_key, &metadata);
        
        // Update bloom filter for quick existence checks
        Self::update_bloom_filter(env, agent_id);
        
        Ok(())
    }
    
    /// Retrieve and decompress fraud reports
    pub fn get_reports(env: &Env, agent_id: &Symbol) -> Result<Vec<FraudReport>, ContractError> {
        let storage_key = Symbol::short(&format!("reports_{}", agent_id));
        let compressed_data = env.storage().instance().get(&storage_key)
            .ok_or(ContractError::NotFound)?;
        
        FraudReportCompressor::decompress_reports(&compressed_data)
    }
    
    /// Get latest score without decompressing all reports
    pub fn get_latest_score(env: &Env, agent_id: &Symbol) -> Result<u32, ContractError> {
        // Store latest score separately for quick access
        let score_key = Symbol::short(&format!("latest_score_{}", agent_id));
        env.storage().instance().get(&score_key)
            .ok_or(ContractError::NotFound)
    }
    
    /// Update latest score when adding new report
    pub fn update_latest_score(
        env: &Env,
        agent_id: &Symbol,
        score: u32,
    ) -> Result<(), ContractError> {
        let score_key = Symbol::short(&format!("latest_score_{}", agent_id));
        env.storage().instance().set(&score_key, &score);
        Ok(())
    }
    
    fn calculate_original_size(reports: &Vec<FraudReport>) -> u32 {
        // Rough calculation: 4 bytes score + 32 bytes address + 8 bytes timestamp per report
        (reports.len() * 44) as u32
    }
    
    fn update_bloom_filter(env: &Env, agent_id: &Symbol) {
        let filter_key = Symbol::short("reports_bloom");
        let mut filter = env.storage().instance().get(&filter_key)
            .unwrap_or_else(|| BloomFilter::new(env, 1024, 3));
        
        let agent_bytes = Bytes::from_slice(env, agent_id.to_string().as_bytes());
        filter.add(env, &agent_bytes);
        
        env.storage().instance().set(&filter_key, &filter);
    }
    
    /// Check if reports exist for an agent (using bloom filter)
    pub fn has_reports(env: &Env, agent_id: &Symbol) -> bool {
        let filter_key = Symbol::short("reports_bloom");
        let filter = env.storage().instance().get(&filter_key)
            .unwrap_or_else(|| BloomFilter::new(env, 1024, 3));
        
        let agent_bytes = Bytes::from_slice(env, agent_id.to_string().as_bytes());
        filter.might_contain(&agent_bytes)
    }
}

/// Report storage metadata
#[contracttype]
#[derive(Clone, Debug)]
pub struct ReportStorageMetadata {
    pub agent_id: Symbol,
    pub report_count: u32,
    pub original_size: u32,
    pub compressed_size: u32,
    pub compression_ratio: f32,
    pub last_updated: u64,
}

/// Efficient score storage
pub struct ScoreStorage;

impl ScoreStorage {
    /// Store scores with compression
    pub fn store_score(
        env: &Env,
        address: &Address,
        score: u32,
        timestamp: u64,
    ) -> Result<(), ContractError> {
        let score_data = ScoreData {
            score,
            timestamp,
            address: address.clone(),
        };
        
        // Compress the score data
        let data_bytes = Self::serialize_score_data(&score_data);
        let compressed_data = CompressionManager::compress(&data_bytes, &CompressionType::BitPacking)?;
        
        let storage_key = Symbol::short(&format!("score_{}", address));
        env.storage().persistent().set(&storage_key, &compressed_data);
        
        // Update score history (compressed)
        Self::update_score_history(env, address, score, timestamp)?;
        
        Ok(())
    }
    
    /// Retrieve and decompress score
    pub fn get_score(env: &Env, address: &Address) -> Result<u32, ContractError> {
        let storage_key = Symbol::short(&format!("score_{}", address));
        let compressed_data = env.storage().persistent().get(&storage_key)
            .ok_or(ContractError::NotFound)?;
        
        let decompressed_data = CompressionManager::decompress(&compressed_data, &CompressionType::BitPacking)?;
        let score_data = Self::deserialize_score_data(&decompressed_data)?;
        
        Ok(score_data.score)
    }
    
    /// Get score history
    pub fn get_score_history(env: &Env, address: &Address, limit: u32) -> Result<Vec<ScoreData>, ContractError> {
        let history_key = Symbol::short(&format!("score_hist_{}", address));
        let compressed_history = env.storage().persistent().get(&history_key)
            .ok_or(ContractError::NotFound)?;
        
        let decompressed_history = CompressionManager::decompress(&compressed_history, &CompressionType::DeltaEncoding)?;
        Self::deserialize_score_history(&decompressed_history, limit)
    }
    
    fn serialize_score_data(data: &ScoreData) -> Bytes {
        let env = Env::default();
        let mut bytes = Vec::new(&env);
        
        // Score (4 bytes)
        let score_bytes = data.score.to_le_bytes();
        for byte in score_bytes.iter() {
            bytes.push_back(*byte);
        }
        
        // Timestamp (8 bytes)
        let timestamp_bytes = data.timestamp.to_le_bytes();
        for byte in timestamp_bytes.iter() {
            bytes.push_back(*byte);
        }
        
        // Address (32 bytes)
        let address_bytes = data.address.to_array();
        for byte in address_bytes.iter() {
            bytes.push_back(*byte);
        }
        
        Bytes::from_slice(&env, &bytes.to_array())
    }
    
    fn deserialize_score_data(data: &Bytes) -> Result<ScoreData, ContractError> {
        let data_array = data.to_array();
        
        if data_array.len() < 44 { // 4 + 8 + 32
            return Err(ContractError::InvalidInput);
        }
        
        let mut score_bytes = [0u8; 4];
        score_bytes.copy_from_slice(&data_array[0..4]);
        let score = u32::from_le_bytes(score_bytes);
        
        let mut timestamp_bytes = [0u8; 8];
        timestamp_bytes.copy_from_slice(&data_array[4..12]);
        let timestamp = u64::from_le_bytes(timestamp_bytes);
        
        let mut address_bytes = [0u8; 32];
        address_bytes.copy_from_slice(&data_array[12..44]);
        let address = Address::from_bytes(&Bytes::from_slice(&Env::default(), &address_bytes));
        
        Ok(ScoreData {
            score,
            timestamp,
            address,
        })
    }
    
    fn update_score_history(
        env: &Env,
        address: &Address,
        score: u32,
        timestamp: u64,
    ) -> Result<(), ContractError> {
        let history_key = Symbol::short(&format!("score_hist_{}", address));
        
        // Get existing history
        let existing_history = env.storage().persistent().get(&history_key);
        let mut history = if let Some(compressed) = existing_history {
            CompressionManager::decompress(&compressed, &CompressionType::DeltaEncoding)?
        } else {
            Bytes::new(&Env::default())
        };
        
        // Add new score to history
        let new_score_data = Self::serialize_score_data(&ScoreData {
            score,
            timestamp,
            address: address.clone(),
        });
        
        // Combine and compress
        let env_default = Env::default();
        let mut combined = Vec::new(&env_default);
        for byte in history.to_array() {
            combined.push_back(byte);
        }
        for byte in new_score_data.to_array() {
            combined.push_back(byte);
        }
        
        let combined_bytes = Bytes::from_slice(&env_default, &combined.to_array());
        let compressed_history = CompressionManager::compress(&combined_bytes, &CompressionType::DeltaEncoding)?;
        
        env.storage().persistent().set(&history_key, &compressed_history);
        
        Ok(())
    }
    
    fn deserialize_score_history(data: &Bytes, limit: u32) -> Result<Vec<ScoreData>, ContractError> {
        let data_array = data.to_array();
        let mut scores = Vec::new(&Env::default());
        let mut offset = 0;
        let mut count = 0;
        
        while offset + 44 <= data_array.len() && count < limit {
            let score_data_bytes = Bytes::from_slice(&Env::default(), &data_array[offset..offset + 44]);
            let score_data = Self::deserialize_score_data(&score_data_bytes)?;
            scores.push_back(score_data);
            
            offset += 44;
            count += 1;
        }
        
        Ok(scores)
    }
}

/// Score data structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct ScoreData {
    pub score: u32,
    pub timestamp: u64,
    pub address: Address,
}
