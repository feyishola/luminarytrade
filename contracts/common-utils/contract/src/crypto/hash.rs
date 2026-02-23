pub enum HashAlgorithm {
    Sha256,
    Keccak256,
    Blake2b,
}

pub trait HashProvider {
    fn hash(data: &Bytes, algorithm: HashAlgorithm) -> CryptoResult<Bytes>;
    fn validate(hash: &Bytes) -> CryptoResult<()>;
}