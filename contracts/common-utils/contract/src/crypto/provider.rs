pub trait CryptoProvider {
    type PublicKey;
    type Signature;
    type Message;

    fn verify(
        &self,
        public_key: &Self::PublicKey,
        message: &Self::Message,
        signature: &Self::Signature,
    ) -> CryptoResult<bool>;
}