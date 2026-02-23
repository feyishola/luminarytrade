pub struct ED25519Provider;

impl CryptoProvider for ED25519Provider {
    type PublicKey = Bytes;
    type Signature = Bytes;
    type Message = Bytes;

    fn verify(...) -> CryptoResult<bool> {
        // Wrap env.crypto().ed25519_verify
    }
}