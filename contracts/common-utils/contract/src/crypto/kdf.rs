pub fn derive_key(
    seed: &Bytes,
    context: &Bytes,
) -> CryptoResult<Bytes>;