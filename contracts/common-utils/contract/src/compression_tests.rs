#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as TestAddress, Bytes as TestBytes},
    Address, Env, Bytes, Vec, Symbol,
};
use crate::compression::{
    BitPackingCompressor, DeltaEncodingCompressor, RunLengthCompressor,
    CompressionManager, AdaptiveCompressor, FraudReportCompressor,
    FraudReport, CompressionType
};
use crate::storage_optimization::{
    BloomFilter, DataSeparator, CompressedReportStorage, ScoreStorage,
    DataTemperature, StorageTier
};
use crate::data_migration::{
    DataMigrationManager, MigrationConfig, MigrationStatus
};
use crate::storage_monitoring::{
    StorageTracker, PerformanceMonitor, EfficiencyAnalyzer
};

#[test]
fn test_bit_packing_compression() {
    let env = Env::default();
    
    // Test with small integers
    let values = Vec::from_array(&env, &[1u32, 2, 3, 4, 5, 255, 256, 1023]);
    let compressed = BitPackingCompressor::compress_u32(&values).unwrap();
    let decompressed = BitPackingCompressor::decompress_u32(&compressed).unwrap();
    
    assert_eq!(values, decompressed);
    
    // Test compression ratio
    let original_size = values.len() * 4; // 4 bytes per u32
    let compression_ratio = compressed.len() as f32 / original_size as f32;
    assert!(compression_ratio < 1.0, "Compression should reduce size");
}

#[test]
fn test_bit_packing_edge_cases() {
    let env = Env::default();
    
    // Test empty vector
    let empty = Vec::<u32>::new(&env);
    let compressed = BitPackingCompressor::compress_u32(&empty).unwrap();
    let decompressed = BitPackingCompressor::decompress_u32(&compressed).unwrap();
    assert_eq!(empty, decompressed);
    
    // Test single value
    let single = Vec::from_array(&env, &[42u32]);
    let compressed = BitPackingCompressor::compress_u32(&single).unwrap();
    let decompressed = BitPackingCompressor::decompress_u32(&compressed).unwrap();
    assert_eq!(single, decompressed);
    
    // Test maximum values
    let max_values = Vec::from_array(&env, &[u32::MAX, u32::MAX, u32::MAX]);
    let compressed = BitPackingCompressor::compress_u32(&max_values).unwrap();
    let decompressed = BitPackingCompressor::decompress_u32(&compressed).unwrap();
    assert_eq!(max_values, decompressed);
}

#[test]
fn test_delta_encoding_compression() {
    let env = Env::default();
    
    // Test with sequential data (should compress well)
    let values = Vec::from_array(&env, &[100u32, 105, 110, 115, 120, 125]);
    let compressed = DeltaEncodingCompressor::compress_u32(&values).unwrap();
    let decompressed = DeltaEncodingCompressor::decompress_u32(&compressed).unwrap();
    
    assert_eq!(values, decompressed);
    
    // Test with non-sequential data
    let random_values = Vec::from_array(&env, &[100u32, 200, 50, 300, 150]);
    let compressed = DeltaEncodingCompressor::compress_u32(&random_values).unwrap();
    let decompressed = DeltaEncodingCompressor::decompress_u32(&compressed).unwrap();
    
    assert_eq!(random_values, decompressed);
}

#[test]
fn test_run_length_compression() {
    let env = Env::default();
    
    // Test with runs
    let values = Vec::from_array(&env, &[1u8, 1, 1, 2, 2, 3, 3, 3, 3, 1]);
    let compressed = RunLengthCompressor::compress_u8(&values).unwrap();
    let decompressed = RunLengthCompressor::decompress_u8(&compressed).unwrap();
    
    assert_eq!(values, decompressed);
    
    // Test compression ratio for repetitive data
    let repetitive = Vec::from_array(&env, &[7u8; 100]);
    let compressed = RunLengthCompressor::compress_u8(&repetitive).unwrap();
    let decompressed = RunLengthCompressor::decompress_u8(&compressed).unwrap();
    
    assert_eq!(repetitive, decompressed);
    assert!(compressed.len() < repetitive.len(), "Should compress repetitive data");
}

#[test]
fn test_fraud_report_compression() {
    let env = Env::default();
    
    // Create test reports
    let reporter1 = TestAddress::generate(&env);
    let reporter2 = TestAddress::generate(&env);
    
    let reports = Vec::from_array(&env, &[
        FraudReport {
            score: 85,
            reporter: reporter1.clone(),
            timestamp: 1640995200, // 2022-01-01
        },
        FraudReport {
            score: 92,
            reporter: reporter2.clone(),
            timestamp: 1641081600, // 2022-01-02
        },
        FraudReport {
            score: 78,
            reporter: reporter1.clone(),
            timestamp: 1641168000, // 2022-01-03
        },
    ]);
    
    // Test compression
    let compressed = FraudReportCompressor::compress_reports(&reports).unwrap();
    let decompressed = FraudReportCompressor::decompress_reports(&compressed).unwrap();
    
    assert_eq!(reports, decompressed);
    
    // Test compression ratio
    let original_size = reports.len() * 44; // Approximate size per report
    let compression_ratio = compressed.len() as f32 / original_size as f32;
    assert!(compression_ratio < 1.0, "Should compress reports");
}

#[test]
fn test_compression_manager() {
    let env = Env::default();
    
    // Test different compression types
    let data = Bytes::from_slice(&env, &[1u8, 2, 3, 4, 5, 255, 0, 128]);
    
    // Test no compression
    let no_compression = CompressionManager::compress(&data, &CompressionType::None).unwrap();
    assert_eq!(data, no_compression);
    
    // Test bit-packing
    let bit_packed = CompressionManager::compress(&data, &CompressionType::BitPacking);
    assert!(bit_packed.is_ok(), "Bit-packing should succeed");
    
    if let Ok(compressed) = bit_packed {
        let decompressed = CompressionManager::decompress(&compressed, &CompressionType::BitPacking).unwrap();
        assert_eq!(data, decompressed);
    }
}

#[test]
fn test_adaptive_compression() {
    let env = Env::default();
    
    // Test with data that should compress well
    let sequential_data = Bytes::from_slice(&env, &[1u8; 100]);
    let (compressed, compression_type) = AdaptiveCompressor::analyze_and_compress(&sequential_data).unwrap();
    
    // Should choose some compression
    assert!(compression_type != CompressionType::None);
    
    // Verify decompression
    let decompressed = CompressionManager::decompress(&compressed, &compression_type).unwrap();
    assert_eq!(sequential_data, decompressed);
    
    // Test with small data (should not compress)
    let small_data = Bytes::from_slice(&env, &[1u8, 2, 3]);
    let (compressed2, compression_type2) = AdaptiveCompressor::analyze_and_compress(&small_data).unwrap();
    
    // Should choose no compression for small data
    assert_eq!(compression_type2, CompressionType::None);
    assert_eq!(small_data, compressed2);
}

#[test]
fn test_bloom_filter() {
    let env = Env::default();
    
    let mut filter = BloomFilter::new(&env, 1024, 3);
    
    // Test adding and checking items
    let item1 = Bytes::from_slice(&env, b"item1");
    let item2 = Bytes::from_slice(&env, b"item2");
    let item3 = Bytes::from_slice(&env, b"item3");
    
    filter.add(&env, &item1);
    filter.add(&env, &item2);
    
    // Test positive cases (might contain)
    assert!(filter.might_contain(&item1));
    assert!(filter.might_contain(&item2));
    
    // Test negative case (definitely doesn't contain)
    assert!(!filter.might_contain(&item3));
    
    // Test false positive rate
    let fpr = filter.false_positive_rate();
    assert!(fpr >= 0.0 && fpr <= 1.0);
}

#[test]
fn test_data_temperature_classification() {
    let env = Env::default();
    
    // Mock current time
    let current_time = 1641168000; // 2022-01-03
    
    // Test hot data (recent, high access)
    let hot_temp = DataSeparator::classify_data(
        &env,
        &Symbol::short("test_key"),
        15, // access count
        current_time - 1800, // 30 minutes ago
    );
    assert_eq!(hot_temp, DataTemperature::Hot);
    
    // Test cold data (old, low access)
    let cold_temp = DataSeparator::classify_data(
        &env,
        &Symbol::short("test_key"),
        2, // access count
        current_time - 86400 * 10, // 10 days ago
    );
    assert_eq!(cold_temp, DataTemperature::Cold);
}

#[test]
fn test_compressed_report_storage() {
    let env = Env::default();
    
    let agent_id = Symbol::short("agent123");
    let reporter = TestAddress::generate(&env);
    
    let reports = Vec::from_array(&env, &[
        FraudReport {
            score: 85,
            reporter: reporter.clone(),
            timestamp: 1640995200,
        },
        FraudReport {
            score: 90,
            reporter: reporter.clone(),
            timestamp: 1641081600,
        },
    ]);
    
    // Store reports
    CompressedReportStorage::store_reports(&env, &agent_id, &reports).unwrap();
    
    // Check if reports exist
    assert!(CompressedReportStorage::has_reports(&env, &agent_id));
    
    // Retrieve reports
    let retrieved = CompressedReportStorage::get_reports(&env, &agent_id).unwrap();
    assert_eq!(reports, retrieved);
    
    // Test latest score
    CompressedReportStorage::update_latest_score(&env, &agent_id, 90).unwrap();
    let latest_score = CompressedReportStorage::get_latest_score(&env, &agent_id).unwrap();
    assert_eq!(latest_score, 90);
}

#[test]
fn test_score_storage() {
    let env = Env::default();
    let address = TestAddress::generate(&env);
    
    // Store score
    ScoreStorage::store_score(&env, &address, 750, 1640995200).unwrap();
    
    // Retrieve score
    let retrieved_score = ScoreStorage::get_score(&env, &address).unwrap();
    assert_eq!(retrieved_score, 750);
    
    // Test score history
    ScoreStorage::store_score(&env, &address, 760, 1641081600).unwrap();
    ScoreStorage::store_score(&env, &address, 770, 1641168000).unwrap();
    
    let history = ScoreStorage::get_score_history(&env, &address, 3).unwrap();
    assert_eq!(history.len(), 3);
}

#[test]
fn test_data_migration() {
    let env = Env::default();
    
    // Create test data
    let data_key1 = Symbol::short("test_key1");
    let data_key2 = Symbol::short("test_key2");
    let data_keys = Vec::from_array(&env, &[data_key1.clone(), data_key2.clone()]);
    
    // Store test data
    let test_data1 = Bytes::from_slice(&env, b"test data 1");
    let test_data2 = Bytes::from_slice(&env, b"test data 2");
    env.storage().instance().set(&data_key1, &test_data1);
    env.storage().instance().set(&data_key2, &test_data2);
    
    // Configure migration
    let config = MigrationConfig {
        batch_size: 2,
        max_retries: 3,
        rollback_enabled: true,
        validation_enabled: true,
        compression_type: CompressionType::BitPacking,
        dry_run: false,
    };
    
    // Start migration
    let migration_id = DataMigrationManager::start_migration(&env, &config, &data_keys).unwrap();
    
    // Execute migration
    DataMigrationManager::execute_migration(&env, migration_id).unwrap();
    
    // Check migration status
    let status = DataMigrationManager::get_migration_status(&env, migration_id).unwrap();
    assert_eq!(status.status, MigrationStatus::Completed);
    assert_eq!(status.processed_items, 2);
    assert_eq!(status.failed_items, 0);
    
    // Validate migration
    let is_valid = DataMigrationManager::validate_migration(&env, migration_id).unwrap();
    assert!(is_valid);
    
    // Test rollback
    DataMigrationManager::rollback_migration(&env, migration_id).unwrap();
    
    let rollback_status = DataMigrationManager::get_migration_status(&env, migration_id).unwrap();
    assert_eq!(rollback_status.status, MigrationStatus::RolledBack);
    
    // Verify original data is restored
    let restored_data1 = env.storage().instance().get(&data_key1).unwrap();
    let restored_data2 = env.storage().instance().get(&data_key2).unwrap();
    assert_eq!(restored_data1, test_data1);
    assert_eq!(restored_data2, test_data2);
}

#[test]
fn test_storage_monitoring() {
    let env = Env::default();
    
    // Record storage operations
    let data_key = Symbol::short("test_key");
    StorageTracker::record_operation(&env, &Symbol::short("store"), &data_key, 1024, true);
    StorageTracker::record_operation(&env, &Symbol::short("access"), &data_key, 0, false);
    
    // Get metrics
    let metrics = StorageTracker::get_metrics(&env);
    assert_eq!(metrics.total_size, 1024);
    assert_eq!(metrics.compressed_size, 1024);
    assert_eq!(metrics.total_items, 1);
    assert_eq!(metrics.access_count, 1);
    
    // Test performance monitoring
    PerformanceMonitor::start_timer(&env, &Symbol::short("compress"));
    // Simulate some work
    PerformanceMonitor::end_timer(&env, &Symbol::short("compress"));
    
    let perf_metrics = PerformanceMonitor::get_metrics(&env);
    assert!(perf_metrics.compression_time_ms > 0);
    
    // Test cache hit recording
    PerformanceMonitor::record_cache_hit(&env, true);
    PerformanceMonitor::record_cache_hit(&env, false);
    
    let updated_perf = PerformanceMonitor::get_metrics(&env);
    assert!(updated_perf.cache_hit_rate > 0.0);
}

#[test]
fn test_efficiency_analysis() {
    let env = Env::default();
    
    // Record some test data
    StorageTracker::record_operation(&env, &Symbol::short("store"), &Symbol::short("test1"), 2048, true);
    StorageTracker::record_operation(&env, &Symbol::short("store"), &Symbol::short("test2"), 1024, false);
    
    PerformanceMonitor::record_cache_hit(&env, true);
    PerformanceMonitor::record_cache_hit(&env, true);
    PerformanceMonitor::record_cache_hit(&env, false);
    
    // Analyze efficiency
    let report = EfficiencyAnalyzer::analyze_efficiency(&env).unwrap();
    
    assert!(report.space_savings_percent >= 0.0);
    assert!(report.compression_ratio >= 0.0 && report.compression_ratio <= 1.0);
    assert!(report.cache_hit_rate >= 0.0 && report.cache_hit_rate <= 1.0);
    assert!(!report.recommendations.is_empty());
}

#[test]
fn test_compression_edge_cases() {
    let env = Env::default();
    
    // Test with maximum size data
    let large_data = vec![255u8; 10000];
    let data_bytes = Bytes::from_slice(&env, &large_data);
    
    let compressed = CompressionManager::compress(&data_bytes, &CompressionType::RunLength);
    assert!(compressed.is_ok(), "Should compress large data");
    
    if let Ok(compressed_data) = compressed {
        let decompressed = CompressionManager::decompress(&compressed_data, &CompressionType::RunLength).unwrap();
        assert_eq!(data_bytes, decompressed);
    }
    
    // Test with all zeros
    let zero_data = vec![0u8; 1000];
    let zero_bytes = Bytes::from_slice(&env, &zero_data);
    
    let compressed_zeros = CompressionManager::compress(&zero_bytes, &CompressionType::RunLength).unwrap();
    let decompressed_zeros = CompressionManager::decompress(&compressed_zeros, &CompressionType::RunLength).unwrap();
    assert_eq!(zero_bytes, decompressed_zeros);
    
    // Run-length should compress zeros very well
    assert!(compressed_zeros.len() < zero_bytes.len());
}

#[test]
fn test_storage_tier_configuration() {
    let env = Env::default();
    
    // Test default tier configurations
    let hot_tier = DataSeparator::get_tier_config(&env, &DataTemperature::Hot);
    assert_eq!(hot_tier.temperature, DataTemperature::Hot);
    assert_eq!(hot_tier.compression_type, CompressionType::None);
    
    let cold_tier = DataSeparator::get_tier_config(&env, &DataTemperature::Cold);
    assert_eq!(cold_tier.temperature, DataTemperature::Cold);
    assert_eq!(cold_tier.compression_type, CompressionType::DeltaEncoding);
}

#[test]
fn test_migration_validation() {
    let env = Env::default();
    
    // Test validation of non-existent migration
    let result = DataMigrationManager::validate_migration(&env, 999);
    assert!(result.is_err());
    
    // Test validation of completed migration
    let data_key = Symbol::short("validation_test");
    let data_keys = Vec::from_array(&env, &[data_key.clone()]);
    
    env.storage().instance().set(&data_key, &Bytes::from_slice(&env, b"test"));
    
    let config = MigrationConfig {
        batch_size: 1,
        max_retries: 1,
        rollback_enabled: false,
        validation_enabled: true,
        compression_type: CompressionType::BitPacking,
        dry_run: false,
    };
    
    let migration_id = DataMigrationManager::start_migration(&env, &config, &data_keys).unwrap();
    DataMigrationManager::execute_migration(&env, migration_id).unwrap();
    
    let is_valid = DataMigrationManager::validate_migration(&env, migration_id).unwrap();
    assert!(is_valid);
}

#[test]
fn test_performance_benchmarks() {
    let env = Env::default();
    
    // Test benchmark functionality
    let results = EfficiencyAnalyzer::benchmark_operations(&env);
    assert!(results.is_ok());
    
    if let Ok(benchmark_results) = results {
        assert!(benchmark_results.iterations > 0);
        assert!(benchmark_results.test_data_size > 0);
        assert!(!benchmark_results.compression_times.is_empty());
        assert!(!benchmark_results.decompression_times.is_empty());
        
        let avg_compression = benchmark_results.get_avg_compression_time();
        let avg_decompression = benchmark_results.get_avg_decompression_time();
        
        assert!(avg_compression > 0);
        assert!(avg_decompression > 0);
    }
}

#[test]
fn test_compression_correctness() {
    let env = Env::default();
    
    // Test with various data patterns
    let test_cases = vec![
        vec![1u8, 2, 3, 4, 5],           // Sequential
        vec![255u8, 254, 253, 252, 251], // Reverse sequential
        vec![0u8; 100],                    // All zeros
        vec![255u8; 100],                  // All max
        vec![1u8, 1, 1, 2, 2, 2, 3, 3], // Repetitive
        vec![42u8; 50],                    // Constant
    ];
    
    for test_data in test_cases {
        let data_bytes = Bytes::from_slice(&env, &test_data);
        
        // Test all compression types
        let compression_types = vec![
            CompressionType::BitPacking,
            CompressionType::DeltaEncoding,
            CompressionType::RunLength,
        ];
        
        for compression_type in compression_types {
            let compressed = CompressionManager::compress(&data_bytes, &compression_type);
            if compressed.is_ok() {
                let compressed_data = compressed.unwrap();
                let decompressed = CompressionManager::decompress(&compressed_data, &compression_type).unwrap();
                assert_eq!(data_bytes, decompressed, 
                    "Decompressed data doesn't match original for compression type: {:?}", compression_type);
            }
        }
    }
}

#[test]
fn test_decompression_accuracy() {
    let env = Env::default();
    
    // Test with random data
    let random_data: Vec<u8> = (0..1000).map(|_| rand::random::<u8>()).collect();
    let data_bytes = Bytes::from_slice(&env, &random_data);
    
    // Test adaptive compression
    let (compressed, compression_type) = AdaptiveCompressor::analyze_and_compress(&data_bytes).unwrap();
    let decompressed = CompressionManager::decompress(&compressed, &compression_type).unwrap();
    
    assert_eq!(data_bytes, decompressed, "Adaptive compression/decompression failed");
    
    // Verify byte-by-byte accuracy
    let original_array = data_bytes.to_array();
    let decompressed_array = decompressed.to_array();
    
    assert_eq!(original_array.len(), decompressed_array.len());
    for (i, (orig, decomp)) in original_array.iter().zip(decompressed_array.iter()).enumerate() {
        assert_eq!(orig, decomp, "Mismatch at byte {}: {} != {}", i, orig, decomp);
    }
}
