#[derive(Debug)]
pub enum CryptoError {
    InvalidSignature,
    InvalidHashLength,
    UnsupportedAlgorithm,
    KeyDerivationFailed,
    VerificationFailed(String),
}