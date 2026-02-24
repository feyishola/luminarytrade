//! Tests for the parser framework

#[cfg(test)]
mod tests {
    use super::super::*;
    use soroban_sdk::{Bytes, Env, Vec};
    use crate::error::ValidationError;
    
    #[test]
    fn test_parse_valid_cid() {
        let env = Env::default();
        let parser = MetadataParser::new();
        
        let valid_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let result = parser.parse_cid(&env, &valid_cid);
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), valid_cid);
    }
    
    #[test]
    fn test_parse_invalid_cid_too_short() {
        let env = Env::default();
        let parser = MetadataParser::new();
        
        let short_cid = Bytes::from_slice(&env, b"Qm");
        let result = parser.parse_cid(&env, &short_cid);
        
        assert_eq!(result, Err(ValidationError::InvalidLength));
    }
    
    #[test]
    fn test_parse_invalid_cid_too_long() {
        let env = Env::default();
        let parser = MetadataParser::new();
        
        let long_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let result = parser.parse_cid(&env, &long_cid);
        
        assert_eq!(result, Err(ValidationError::InvalidLength));
    }
    
    #[test]
    fn test_parse_valid_hash() {
        let env = Env::default();
        let parser = MetadataParser::new();
        
        let valid_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let result = parser.parse_hash(&env, &valid_hash);
        
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_parse_invalid_hash_too_short() {
        let env = Env::default();
        let parser = MetadataParser::new();
        
        let short_hash = Bytes::from_slice(&env, b"abc");
        let result = parser.parse_hash(&env, &short_hash);
        
        assert_eq!(result, Err(ValidationError::InvalidHashFormat));
    }
    
    #[test]
    fn test_parse_required_field() {
        let env = Env::default();
        let parser = MetadataParser::new();
        
        let field = Bytes::from_slice(&env, b"TestValue");
        let result = parser.parse_required_field(&env, &field, "test");
        
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_parse_empty_required_field_strict() {
        let env = Env::default();
        let parser = MetadataParser::new();
        
        let empty_field = Bytes::from_slice(&env, b"");
        let result = parser.parse_required_field(&env, &empty_field, "test");
        
        assert_eq!(result, Err(ValidationError::MissingRequiredField));
    }
    
    #[test]
    fn test_parse_empty_field_lenient() {
        let env = Env::default();
        let config = ParserConfig::lenient();
        let parser = MetadataParser::with_config(config);
        
        let empty_field = Bytes::from_slice(&env, b"");
        let result = parser.parse_required_field(&env, &empty_field, "test");
        
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_parse_complete_metadata() {
        let env = Env::default();
        let parser = MetadataParser::new();
        
        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let name = Bytes::from_slice(&env, b"TestAgent");
        let description = Bytes::from_slice(&env, b"A test agent");
        let version = Bytes::from_slice(&env, b"1.0.0");
        let extra_fields = Vec::new(&env);
        
        let result = parser.parse_metadata(
            &env,
            json_cid.clone(),
            model_hash.clone(),
            name.clone(),
            description.clone(),
            version.clone(),
            extra_fields,
        );
        
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.json_cid, json_cid);
        assert_eq!(metadata.model_hash, model_hash);
        assert_eq!(metadata.name, name);
    }
    
    #[test]
    fn test_builder_pattern() {
        let env = Env::default();
        
        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let name = Bytes::from_slice(&env, b"TestAgent");
        let description = Bytes::from_slice(&env, b"A test agent");
        let version = Bytes::from_slice(&env, b"1.0.0");
        
        let result = MetadataBuilder::new()
            .with_cid(json_cid.clone())
            .with_hash(model_hash.clone())
            .with_name(name.clone())
            .with_description(description.clone())
            .with_version(version.clone())
            .build(&env);
        
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.name, name);
    }
    
    #[test]
    fn test_builder_missing_required_field() {
        let env = Env::default();
        
        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        
        let result = MetadataBuilder::new()
            .with_cid(json_cid)
            .with_hash(model_hash)
            // Missing name, description, version
            .build(&env);
        
        assert_eq!(result, Err(ValidationError::MissingRequiredField));
    }
    
    #[test]
    fn test_builder_with_extra_fields() {
        let env = Env::default();
        
        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let name = Bytes::from_slice(&env, b"TestAgent");
        let description = Bytes::from_slice(&env, b"A test agent");
        let version = Bytes::from_slice(&env, b"1.0.0");
        let key = Bytes::from_slice(&env, b"custom_key");
        let value = Bytes::from_slice(&env, b"custom_value");
        
        let result = MetadataBuilder::new()
            .with_cid(json_cid)
            .with_hash(model_hash)
            .with_name(name)
            .with_description(description)
            .with_version(version)
            .add_extra_field(&env, key.clone(), value.clone())
            .build(&env);
        
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.extra_fields.len(), 1);
    }
    
    #[test]
    fn test_parser_with_size_limits() {
        let env = Env::default();
        let config = ParserConfig::strict_with_limits(50);
        let parser = MetadataParser::with_config(config);
        
        let long_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let result = parser.parse_cid(&env, &long_cid);
        
        // Should fail because CID is longer than 50 bytes
        assert_eq!(result, Err(ValidationError::InvalidLength));
    }
    
    #[test]
    fn test_config_builder() {
        let config = ConfigBuilder::new()
            .strict(true)
            .max_size(100)
            .allow_empty(false)
            .custom_validation(true)
            .build();
        
        assert_eq!(config.strict, true);
        assert_eq!(config.max_size, Some(100));
        assert_eq!(config.allow_empty, false);
        assert_eq!(config.custom_validation, true);
    }
    
    #[test]
    fn test_parser_presets() {
        let _default = ParserPresets::default();
        let _lenient = ParserPresets::lenient();
        let _production = ParserPresets::production();
        let _development = ParserPresets::development();
        let _secure = ParserPresets::secure();
        
        // Just ensure they compile and can be created
        assert!(true);
    }
}
