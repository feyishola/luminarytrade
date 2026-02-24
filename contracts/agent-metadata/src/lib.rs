#![no_std]

use soroban_sdk::{contracttype, Bytes, Env, Vec};
use common_utils::error::{ValidationError, ContractError};
use common_utils::validator::{
    Validator,
    CIDValidator,
    HashValidator,
    BytesValidator,
    ValidatorConfig,
};

/// Legacy error type for backward compatibility
/// Maps to new ValidationError codes
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MetadataError {
    /// Invalid JSON format -> ValidationError::InvalidJsonStructure
    InvalidJsonFormat = 1,
    /// Missing required field -> ValidationError::MissingRequiredField
    MissingRequiredField = 2,
    /// Invalid CID format -> ValidationError::InvalidCidFormat
    InvalidCidFormat = 3,
    /// Hash verification failed -> ValidationError::InvalidHashFormat
    HashVerificationFailed = 4,
    /// Invalid metadata structure -> ValidationError::InvalidFormat
    InvalidStructure = 5,
    /// CID too long -> ValidationError::InvalidLength
    CidTooLong = 6,
    /// Hash too long -> ValidationError::InvalidLength
    HashTooLong = 7,
}

impl MetadataError {
    /// Convert legacy MetadataError to new ValidationError
    pub fn to_validation_error(&self) -> ValidationError {
        match self {
            MetadataError::InvalidJsonFormat => ValidationError::InvalidJsonStructure,
            MetadataError::MissingRequiredField => ValidationError::MissingRequiredField,
            MetadataError::InvalidCidFormat => ValidationError::InvalidCidFormat,
            MetadataError::HashVerificationFailed => ValidationError::InvalidHashFormat,
            MetadataError::InvalidStructure => ValidationError::InvalidFormat,
            MetadataError::CidTooLong | MetadataError::HashTooLong =>
                ValidationError::InvalidLength,
        }
    }
}

/// Structured agent metadata object
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AgentMetadata {
    /// JSON CID pointing to the metadata
    pub json_cid: Bytes,
    /// Model hash for verification
    pub model_hash: Bytes,
    /// Agent name
    pub name: Bytes,
    /// Agent description
    pub description: Bytes,
    /// Agent version
    pub version: Bytes,
    /// Additional metadata fields
    pub extra_fields: Vec<(Bytes, Bytes)>,
}

/// Main metadata validator and parser using the validator framework
pub struct MetadataValidator {
    cid_validator: CIDValidator,
    hash_validator: HashValidator,
    name_validator: BytesValidator,
    description_validator: BytesValidator,
    version_validator: BytesValidator,
}

impl MetadataValidator {
    /// Create a new validator instance with default configurations
    pub fn new() -> Self {
        Self {
            cid_validator: CIDValidator::new(),
            hash_validator: HashValidator::new(),
            name_validator: BytesValidator::new().with_config(
                ValidatorConfig::new().with_length_bounds(1, 100)
            ),
            description_validator: BytesValidator::new().with_config(
                ValidatorConfig::new().with_length_bounds(1, 1000)
            ),
            version_validator: BytesValidator::new().with_config(
                ValidatorConfig::new().with_length_bounds(1, 50)
            ),
        }
    }

    /// Create a validator with custom configurations
    pub fn with_config(
        cid_config: ValidatorConfig,
        hash_config: ValidatorConfig,
        name_config: ValidatorConfig,
        description_config: ValidatorConfig,
        version_config: ValidatorConfig
    ) -> Self {
        Self {
            cid_validator: CIDValidator::with_config(cid_config),
            hash_validator: HashValidator::with_config(hash_config),
            name_validator: BytesValidator::with_config(name_config),
            description_validator: BytesValidator::with_config(description_config),
            version_validator: BytesValidator::with_config(version_config),
        }
    }

    /// Validate and parse agent metadata from raw components
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `json_cid` - CID pointing to JSON metadata
    /// * `model_hash` - Hash for model verification
    /// * `name` - Agent name
    /// * `description` - Agent description
    /// * `version` - Agent version
    /// * `extra_fields` - Additional metadata fields
    ///
    /// # Returns
    /// * `Ok(AgentMetadata)` - Validated metadata object
    /// * `Err(MetadataError)` - Validation error
    pub fn validate_and_parse(
        &self,
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
        name: Bytes,
        description: Bytes,
        version: Bytes,
        extra_fields: Vec<(Bytes, Bytes)>
    ) -> Result<AgentMetadata, MetadataError> {
        // Validate JSON CID format using validator framework
        self.cid_validator.validate(env, &json_cid).map_err(|_| MetadataError::InvalidCidFormat)?;

        // Validate model hash format using validator framework
        self.hash_validator
            .validate(env, &model_hash)
            .map_err(|_| MetadataError::HashVerificationFailed)?;

        // Validate required fields using validator framework
        self.name_validator.validate(env, &name).map_err(|_| MetadataError::MissingRequiredField)?;

        self.description_validator
            .validate(env, &description)
            .map_err(|_| MetadataError::MissingRequiredField)?;

        self.version_validator
            .validate(env, &version)
            .map_err(|_| MetadataError::MissingRequiredField)?;

        // Create structured metadata object
        let metadata = AgentMetadata {
            json_cid,
            model_hash,
            name,
            description,
            version,
            extra_fields,
        };

        Ok(metadata)
    }

    /// Validate JSON CID format only
    pub fn validate_cid(&self, env: &Env, cid: &Bytes) -> Result<(), MetadataError> {
        self.cid_validator.validate(env, cid).map_err(|_| MetadataError::InvalidCidFormat)
    }

    /// Validate model hash format only
    pub fn validate_model_hash(&self, env: &Env, hash: &Bytes) -> Result<(), MetadataError> {
        self.hash_validator.validate(env, hash).map_err(|_| MetadataError::HashVerificationFailed)
    }

    /// Verify that a provided hash matches the expected hash
    pub fn verify_hash(
        &self,
        provided_hash: &Bytes,
        expected_hash: &Bytes
    ) -> Result<(), MetadataError> {
        if provided_hash == expected_hash {
            Ok(())
        } else {
            Err(MetadataError::HashVerificationFailed)
        }
    }

    /// Get the CID validator for external use
    pub fn cid_validator(&self) -> &CIDValidator {
        &self.cid_validator
    }

    /// Get the hash validator for external use
    pub fn hash_validator(&self) -> &HashValidator {
        &self.hash_validator
    }

    /// Get the name validator for external use
    pub fn name_validator(&self) -> &BytesValidator {
        &self.name_validator
    }
}

impl Default for MetadataValidator {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience functions for common validation operations
pub mod convenience {
    use super::*;

    /// Quick validation of all metadata components
    pub fn validate_metadata_quick(
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
        name: Bytes,
        description: Bytes,
        version: Bytes
    ) -> Result<AgentMetadata, MetadataError> {
        let validator = MetadataValidator::new();
        let empty_fields = Vec::new(env);
        validator.validate_and_parse(
            env,
            json_cid,
            model_hash,
            name,
            description,
            version,
            empty_fields
        )
    }

    /// Validate only CID and hash (for quick checks)
    pub fn validate_cid_and_hash(
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes
    ) -> Result<(), MetadataError> {
        let validator = MetadataValidator::new();
        validator.validate_cid(env, &json_cid)?;
        validator.validate_model_hash(env, &model_hash)?;
        Ok(())
    }

    /// Validate with custom configurations
    pub fn validate_with_custom_config(
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
        name: Bytes,
        description: Bytes,
        version: Bytes,
        extra_fields: Vec<(Bytes, Bytes)>,
        cid_config: ValidatorConfig,
        hash_config: ValidatorConfig
    ) -> Result<AgentMetadata, MetadataError> {
        let validator = MetadataValidator::with_config(
            cid_config,
            hash_config,
            ValidatorConfig::new().with_length_bounds(1, 100),
            ValidatorConfig::new().with_length_bounds(1, 1000),
            ValidatorConfig::new().with_length_bounds(1, 50)
        );

        validator.validate_and_parse(
            env,
            json_cid,
            model_hash,
            name,
            description,
            version,
            extra_fields
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Bytes, Env, Vec};

    #[test]
    fn test_valid_cid_validation() {
        let env = Env::default();
        let validator = CIDValidator::new();

        let valid_cid_v0 = Bytes::from_slice(
            &env,
            b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
        );
        let valid_cid_v1 = Bytes::from_slice(
            &env,
            b"bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        );

        assert!(validator.validate(&env, &valid_cid_v0).is_ok());
        assert!(validator.validate(&env, &valid_cid_v1).is_ok());
    }

    #[test]
    fn test_invalid_cid_validation() {
        let env = Env::default();
        let validator = CIDValidator::new();

        let empty_cid = Bytes::from_slice(&env, b"");
        let short_cid = Bytes::from_slice(&env, b"Qm");
        let long_cid = Bytes::from_slice(
            &env,
            b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
        );

        assert!(validator.validate(&env, &empty_cid).is_err());
        assert!(validator.validate(&env, &short_cid).is_err());
        assert!(validator.validate(&env, &long_cid).is_err());
    }

    #[test]
    fn test_valid_hash_validation() {
        let env = Env::default();
        let validator = HashValidator::new();

        let valid_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let short_valid_hash = Bytes::from_slice(&env, b"00000000000000000000000000000000");

        assert!(validator.validate(&env, &valid_hash).is_ok());
        assert!(validator.validate(&env, &short_valid_hash).is_ok());
    }

    #[test]
    fn test_invalid_hash_validation() {
        let env = Env::default();
        let validator = HashValidator::new();

        let empty_hash = Bytes::from_slice(&env, b"");
        let short_hash = Bytes::from_slice(&env, b"abc");

        assert!(validator.validate(&env, &empty_hash).is_err());
        assert!(validator.validate(&env, &short_hash).is_err());
    }

    #[test]
    fn test_complete_metadata_validation() {
        let env = Env::default();
        let validator = MetadataValidator::new();

        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let name = Bytes::from_slice(&env, b"TestAgent");
        let description = Bytes::from_slice(&env, b"A test agent for validation");
        let version = Bytes::from_slice(&env, b"1.0.0");
        let extra_fields = Vec::new(&env);

        let result = validator.validate_and_parse(
            &env,
            json_cid.clone(),
            model_hash.clone(),
            name.clone(),
            description.clone(),
            version.clone(),
            extra_fields
        );

        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.json_cid, json_cid);
        assert_eq!(metadata.model_hash, model_hash);
        assert_eq!(metadata.name, name);
        assert_eq!(metadata.description, description);
        assert_eq!(metadata.version, version);
    }

    #[test]
    fn test_missing_required_fields() {
        let env = Env::default();
        let validator = MetadataValidator::new();

        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let empty_name = Bytes::from_slice(&env, b"");
        let description = Bytes::from_slice(&env, b"A test agent");
        let version = Bytes::from_slice(&env, b"1.0.0");
        let extra_fields = Vec::new(&env);

        let result = validator.validate_and_parse(
            &env,
            json_cid,
            model_hash,
            empty_name,
            description,
            version,
            extra_fields
        );

        assert_eq!(result, Err(MetadataError::MissingRequiredField));
    }

    #[test]
    fn test_convenience_functions() {
        let env = Env::default();

        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let name = Bytes::from_slice(&env, b"TestAgent");
        let description = Bytes::from_slice(&env, b"A test agent");
        let version = Bytes::from_slice(&env, b"1.0.0");

        let result = convenience::validate_metadata_quick(
            &env,
            json_cid,
            model_hash,
            name,
            description,
            version
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_custom_validator_configurations() {
        let env = Env::default();

        let cid_config = ValidatorConfig::new()
            .with_length_bounds(5, 150)
            .strict(false);

        let hash_config = ValidatorConfig::new()
            .with_length_bounds(20, 200)
            .strict(false);

        let json_cid = Bytes::from_slice(&env, b"short");
        let model_hash = Bytes::from_slice(&env, b"short_hash_for_testing");
        let name = Bytes::from_slice(&env, b"TestAgent");
        let description = Bytes::from_slice(&env, b"A test agent");
        let version = Bytes::from_slice(&env, b"1.0.0");
        let extra_fields = Vec::new(&env);

        let result = convenience::validate_with_custom_config(
            &env,
            json_cid,
            model_hash,
            name,
            description,
            version,
            extra_fields,
            cid_config,
            hash_config
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_validator_accessors() {
        let validator = MetadataValidator::new();

        let cid_validator = validator.cid_validator();
        let hash_validator = validator.hash_validator();
        let name_validator = validator.name_validator();

        assert_eq!(cid_validator.name(), "CIDValidator");
        assert_eq!(hash_validator.name(), "HashValidator");
        assert_eq!(name_validator.name(), "BytesValidator");
    }
}
