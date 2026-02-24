#![no_std]

use soroban_sdk::{
    contracttype, Address, Env, Bytes, Vec, Symbol, U256, Map, 
    panic_with_error
};
use crate::error::ContractError;

/// Compression algorithms available
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CompressionType {
    None,
    BitPacking,
    DeltaEncoding,
    RunLength,
    Huffman,
    Custom(Symbol),
}

/// Compression metadata for tracking compression statistics
#[contracttype]
#[derive(Clone, Debug)]
pub struct CompressionMetadata {
    pub original_size: u32,
    pub compressed_size: u32,
    pub compression_type: CompressionType,
    pub compression_ratio: f32,
    pub timestamp: u64,
}

/// Bit-packing compressor for small integers
pub struct BitPackingCompressor;

impl BitPackingCompressor {
    /// Pack u32 values into bytes using optimal bit width
    pub fn compress_u32(values: &Vec<u32>) -> Result<Bytes, ContractError> {
        if values.is_empty() {
            return Ok(Bytes::new(&Env::default()));
        }

        let env = Env::default();
        let max_value = values.iter().max().unwrap_or(&0);
        let bit_width = Self::calculate_bit_width(*max_value);
        
        let mut packed_data = Vec::new(&env);
        let mut current_byte = 0u8;
        let mut bits_used = 0u8;
        
        // Store bit width as first byte
        packed_data.push_back(bit_width);
        
        for &value in values {
            let mut remaining_bits = bit_width;
            let mut value_bits = value;
            
            while remaining_bits > 0 {
                let bits_to_pack = remaining_bits.min(8 - bits_used);
                let mask = (1u32 << bits_to_pack) - 1;
                let bits = (value_bits & mask) as u8;
                
                current_byte |= (bits << bits_used);
                bits_used += bits_to_pack;
                remaining_bits -= bits_to_pack;
                value_bits >>= bits_to_pack;
                
                if bits_used == 8 {
                    packed_data.push_back(current_byte);
                    current_byte = 0;
                    bits_used = 0;
                }
            }
        }
        
        // Push last byte if has remaining bits
        if bits_used > 0 {
            packed_data.push_back(current_byte);
        }
        
        Ok(Bytes::from_slice(&env, &packed_data.to_array()))
    }
    
    /// Decompress bit-packed u32 values
    pub fn decompress_u32(data: &Bytes) -> Result<Vec<u32>, ContractError> {
        let env = Env::default();
        let data_array = data.to_array();
        
        if data_array.len() == 0 {
            return Ok(Vec::new(&env));
        }
        
        let bit_width = data_array[0];
        if bit_width == 0 || bit_width > 32 {
            return Err(ContractError::InvalidInput);
        }
        
        let mut values = Vec::new(&env);
        let mut current_value = 0u32;
        let mut bits_collected = 0u8;
        
        for &byte in &data_array[1..] {
            let mut remaining_bits = 8u8;
            
            while remaining_bits > 0 {
                let bits_to_take = remaining_bits.min(bit_width - bits_collected);
                let mask = (1u8 << bits_to_take) - 1;
                let bits = (byte & mask) as u32;
                
                current_value |= (bits << bits_collected);
                bits_collected += bits_to_take;
                remaining_bits -= bits_to_take;
                
                if bits_collected == bit_width {
                    values.push_back(current_value);
                    current_value = 0;
                    bits_collected = 0;
                }
            }
        }
        
        Ok(values)
    }
    
    fn calculate_bit_width(max_value: u32) -> u8 {
        if max_value == 0 { return 1; }
        32 - max_value.leading_zeros() as u8
    }
}

/// Delta encoding compressor for sequences
pub struct DeltaEncodingCompressor;

impl DeltaEncodingCompressor {
    /// Compress using delta encoding + bit-packing
    pub fn compress_u32(values: &Vec<u32>) -> Result<Bytes, ContractError> {
        if values.is_empty() {
            return Ok(Bytes::new(&Env::default()));
        }

        let env = Env::default();
        
        // Store first value as-is
        let mut deltas = Vec::new(&env);
        if let Some(&first) = values.first() {
            deltas.push_back(first);
        }
        
        // Calculate deltas
        for i in 1..values.len() {
            let delta = if i > 0 {
                values.get(i).unwrap() - values.get(i - 1).unwrap()
            } else {
                *values.get(i).unwrap()
            };
            deltas.push_back(delta);
        }
        
        // Apply bit-packing to deltas
        BitPackingCompressor::compress_u32(&deltas)
    }
    
    /// Decompress delta-encoded values
    pub fn decompress_u32(data: &Bytes) -> Result<Vec<u32>, ContractError> {
        let deltas = BitPackingCompressor::decompress_u32(data)?;
        let env = Env::default();
        
        if deltas.is_empty() {
            return Ok(Vec::new(&env));
        }
        
        let mut values = Vec::new(&env);
        let mut previous = 0u32;
        
        for (i, &delta) in deltas.iter().enumerate() {
            if i == 0 {
                values.push_back(delta);
                previous = delta;
            } else {
                let current = previous + delta;
                values.push_back(current);
                previous = current;
            }
        }
        
        Ok(values)
    }
}

/// Run-length encoding compressor
pub struct RunLengthCompressor;

impl RunLengthCompressor {
    /// Compress using run-length encoding
    pub fn compress_u8(values: &Vec<u8>) -> Result<Bytes, ContractError> {
        if values.is_empty() {
            return Ok(Bytes::new(&Env::default()));
        }

        let env = Env::default();
        let mut compressed = Vec::new(&env);
        
        let mut current = values.get(0).unwrap();
        let mut count = 1u8;
        
        for i in 1..values.len() {
            let value = values.get(i).unwrap();
            if *value == *current && count < 255 {
                count += 1;
            } else {
                compressed.push_back(*current);
                compressed.push_back(count);
                current = value;
                count = 1;
            }
        }
        
        // Push last run
        compressed.push_back(*current);
        compressed.push_back(count);
        
        Ok(Bytes::from_slice(&env, &compressed.to_array()))
    }
    
    /// Decompress run-length encoded data
    pub fn decompress_u8(data: &Bytes) -> Result<Vec<u8>, ContractError> {
        let env = Env::default();
        let data_array = data.to_array();
        
        if data_array.len() == 0 || data_array.len() % 2 != 0 {
            return Err(ContractError::InvalidInput);
        }
        
        let mut decompressed = Vec::new(&env);
        
        for chunk in data_array.chunks(2) {
            let value = chunk[0];
            let count = chunk[1];
            
            for _ in 0..count {
                decompressed.push_back(value);
            }
        }
        
        Ok(decompressed)
    }
}

/// Custom compression for FraudReport structures
pub struct FraudReportCompressor;

impl FraudReportCompressor {
    /// Compress a vector of FraudReport structures
    pub fn compress_reports(reports: &Vec<FraudReport>) -> Result<Bytes, ContractError> {
        if reports.is_empty() {
            return Ok(Bytes::new(&Env::default()));
        }

        let env = Env::default();
        let mut scores = Vec::new(&env);
        let mut timestamps = Vec::new(&env);
        let mut reporters = Vec::new(&env);
        
        for report in reports.iter() {
            scores.push_back(report.score);
            timestamps.push_back(report.timestamp);
            reporters.push_back(report.reporter.clone());
        }
        
        // Compress numeric data
        let compressed_scores = DeltaEncodingCompressor::compress_u32(&scores)?;
        let compressed_timestamps = DeltaEncodingCompressor::compress_u32(&timestamps)?;
        
        // Combine all data
        let mut combined = Vec::new(&env);
        
        // Add lengths
        combined.push_back((compressed_scores.len() / 4) as u8);
        combined.push_back((compressed_timestamps.len() / 4) as u8);
        combined.push_back(reporters.len() as u8);
        
        // Add compressed data
        for byte in compressed_scores.iter() {
            combined.push_back(byte);
        }
        for byte in compressed_timestamps.iter() {
            combined.push_back(byte);
        }
        
        // Add reporter addresses (uncompressed for now)
        for reporter in reporters.iter() {
            let reporter_bytes = reporter.to_array();
            for byte in reporter_bytes.iter() {
                combined.push_back(byte);
            }
        }
        
        Ok(Bytes::from_slice(&env, &combined.to_array()))
    }
    
    /// Decompress FraudReport structures
    pub fn decompress_reports(data: &Bytes) -> Result<Vec<FraudReport>, ContractError> {
        let env = Env::default();
        let data_array = data.to_array();
        
        if data_array.len() < 3 {
            return Ok(Vec::new(&env));
        }
        
        let scores_len = data_array[0] as usize * 4;
        let timestamps_len = data_array[1] as usize * 4;
        let reporters_count = data_array[2] as usize;
        
        let mut offset = 3;
        
        // Extract compressed scores
        let scores_data = Bytes::from_slice(&env, &data_array[offset..offset + scores_len]);
        offset += scores_len;
        let scores = DeltaEncodingCompressor::decompress_u32(&scores_data)?;
        
        // Extract compressed timestamps
        let timestamps_data = Bytes::from_slice(&env, &data_array[offset..offset + timestamps_len]);
        offset += timestamps_len;
        let timestamps = DeltaEncodingCompressor::decompress_u32(&timestamps_data)?;
        
        // Extract reporters
        let mut reports = Vec::new(&env);
        let address_size = 32; // Address size in bytes
        
        for i in 0..reporters_count {
            let reporter_start = offset + (i * address_size);
            let reporter_end = reporter_start + address_size;
            
            if reporter_end > data_array.len() {
                break;
            }
            
            let reporter_bytes = &data_array[reporter_start..reporter_end];
            let mut reporter_array = [0u8; 32];
            reporter_array.copy_from_slice(reporter_bytes);
            let reporter = Address::from_bytes(&Bytes::from_slice(&env, &reporter_array));
            
            let score = if i < scores.len() { scores.get(i).unwrap() } else { 0 };
            let timestamp = if i < timestamps.len() { timestamps.get(i).unwrap() } else { 0 };
            
            reports.push_back(FraudReport {
                score,
                reporter,
                timestamp,
            });
        }
        
        Ok(reports)
    }
}

/// FraudReport structure for compression
#[contracttype]
#[derive(Clone, Debug)]
pub struct FraudReport {
    pub score: u32,
    pub reporter: Address,
    pub timestamp: u64,
}

/// Compression manager for handling different compression types
pub struct CompressionManager;

impl CompressionManager {
    /// Compress data using specified algorithm
    pub fn compress(data: &Bytes, compression_type: &CompressionType) -> Result<Bytes, ContractError> {
        match compression_type {
            CompressionType::None => Ok(data.clone()),
            CompressionType::BitPacking => {
                // Convert to u32 vector for bit-packing
                let env = Env::default();
                let mut values = Vec::new(&env);
                for chunk in data.to_array().chunks(4) {
                    if chunk.len() == 4 {
                        let mut bytes = [0u8; 4];
                        bytes.copy_from_slice(chunk);
                        let value = u32::from_le_bytes(bytes);
                        values.push_back(value);
                    }
                }
                BitPackingCompressor::compress_u32(&values)
            }
            CompressionType::DeltaEncoding => {
                let env = Env::default();
                let mut values = Vec::new(&env);
                for chunk in data.to_array().chunks(4) {
                    if chunk.len() == 4 {
                        let mut bytes = [0u8; 4];
                        bytes.copy_from_slice(chunk);
                        let value = u32::from_le_bytes(bytes);
                        values.push_back(value);
                    }
                }
                DeltaEncodingCompressor::compress_u32(&values)
            }
            CompressionType::RunLength => {
                let env = Env::default();
                let values = Vec::from_slice(&env, &data.to_array());
                RunLengthCompressor::compress_u8(&values)
            }
            _ => Err(ContractError::UnsupportedOperation),
        }
    }
    
    /// Decompress data using specified algorithm
    pub fn decompress(data: &Bytes, compression_type: &CompressionType) -> Result<Bytes, ContractError> {
        match compression_type {
            CompressionType::None => Ok(data.clone()),
            CompressionType::BitPacking => {
                let values = BitPackingCompressor::decompress_u32(data)?;
                let env = Env::default();
                let mut bytes = Vec::new(&env);
                for value in values.iter() {
                    let value_bytes = value.to_le_bytes();
                    for byte in value_bytes.iter() {
                        bytes.push_back(*byte);
                    }
                }
                Ok(Bytes::from_slice(&env, &bytes.to_array()))
            }
            CompressionType::DeltaEncoding => {
                let values = DeltaEncodingCompressor::decompress_u32(data)?;
                let env = Env::default();
                let mut bytes = Vec::new(&env);
                for value in values.iter() {
                    let value_bytes = value.to_le_bytes();
                    for byte in value_bytes.iter() {
                        bytes.push_back(*byte);
                    }
                }
                Ok(Bytes::from_slice(&env, &bytes.to_array()))
            }
            CompressionType::RunLength => {
                let values = RunLengthCompressor::decompress_u8(data)?;
                Ok(Bytes::from_slice(&Env::default(), &values.to_array()))
            }
            _ => Err(ContractError::UnsupportedOperation),
        }
    }
    
    /// Calculate compression ratio
    pub fn calculate_compression_ratio(original_size: u32, compressed_size: u32) -> f32 {
        if original_size == 0 { return 0.0; }
        compressed_size as f32 / original_size as f32
    }
    
    /// Get metadata for compression operation
    pub fn get_metadata(
        original_size: u32,
        compressed_size: u32,
        compression_type: CompressionType,
    ) -> CompressionMetadata {
        CompressionMetadata {
            original_size,
            compressed_size,
            compression_type,
            compression_ratio: Self::calculate_compression_ratio(original_size, compressed_size),
            timestamp: Env::default().ledger().timestamp(),
        }
    }
}

/// Adaptive compression that chooses best algorithm
pub struct AdaptiveCompressor;

impl AdaptiveCompressor {
    /// Analyze data and choose best compression algorithm
    pub fn analyze_and_compress(data: &Bytes) -> Result<(Bytes, CompressionType), ContractError> {
        let data_array = data.to_array();
        
        // Skip compression for very small data
        if data_array.len() < 8 {
            return Ok((data.clone(), CompressionType::None));
        }
        
        // Test different compression algorithms
        let mut best_result = (data.clone(), CompressionType::None, data_array.len() as u32);
        
        // Test bit-packing
        if let Ok(compressed) = BitPackingCompressor::compress_u32(&Self::to_u32_vec(data)?) {
            if compressed.len() < best_result.2 as usize {
                best_result = (compressed, CompressionType::BitPacking, compressed.len() as u32);
            }
        }
        
        // Test delta encoding
        if let Ok(compressed) = DeltaEncodingCompressor::compress_u32(&Self::to_u32_vec(data)?) {
            if compressed.len() < best_result.2 as usize {
                best_result = (compressed, CompressionType::DeltaEncoding, compressed.len() as u32);
            }
        }
        
        // Test run-length encoding
        if let Ok(compressed) = RunLengthCompressor::compress_u8(&Self::to_u8_vec(data)?) {
            if compressed.len() < best_result.2 as usize {
                best_result = (compressed, CompressionType::RunLength, compressed.len() as u32);
            }
        }
        
        Ok((best_result.0, best_result.1))
    }
    
    fn to_u32_vec(data: &Bytes) -> Result<Vec<u32>, ContractError> {
        let env = Env::default();
        let mut values = Vec::new(&env);
        for chunk in data.to_array().chunks(4) {
            if chunk.len() == 4 {
                let mut bytes = [0u8; 4];
                bytes.copy_from_slice(chunk);
                values.push_back(u32::from_le_bytes(bytes));
            }
        }
        Ok(values)
    }
    
    fn to_u8_vec(data: &Bytes) -> Result<Vec<u8>, ContractError> {
        let env = Env::default();
        Vec::from_slice(&env, &data.to_array())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Bytes as TestBytes;
    
    #[test]
    fn test_bit_packing_compression() {
        let env = Env::default();
        let values = Vec::from_array(&env, &[1u32, 2, 3, 4, 5]);
        
        let compressed = BitPackingCompressor::compress_u32(&values).unwrap();
        let decompressed = BitPackingCompressor::decompress_u32(&compressed).unwrap();
        
        assert_eq!(values, decompressed);
    }
    
    #[test]
    fn test_delta_encoding_compression() {
        let env = Env::default();
        let values = Vec::from_array(&env, &[100u32, 105, 110, 115, 120]);
        
        let compressed = DeltaEncodingCompressor::compress_u32(&values).unwrap();
        let decompressed = DeltaEncodingCompressor::decompress_u32(&compressed).unwrap();
        
        assert_eq!(values, decompressed);
    }
    
    #[test]
    fn test_run_length_compression() {
        let env = Env::default();
        let values = Vec::from_array(&env, &[1u8, 1, 1, 2, 2, 3, 3, 3, 3]);
        
        let compressed = RunLengthCompressor::compress_u8(&values).unwrap();
        let decompressed = RunLengthCompressor::decompress_u8(&compressed).unwrap();
        
        assert_eq!(values, decompressed);
    }
}
