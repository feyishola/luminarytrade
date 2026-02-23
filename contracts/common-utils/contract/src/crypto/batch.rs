pub fn batch_verify(
    items: &[SignaturePayload]
) -> CryptoResult<Vec<bool>>;