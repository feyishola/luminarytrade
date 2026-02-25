import { IAdapter } from './base-adapter.interface';

/**
 * Wallet adapter interface for handling wallet operations.
 * Abstracts wallet providers (Stellar, etc.) from business logic.
 */
export interface IWalletAdapter extends IAdapter {
  /**
   * Verify a message signature from a wallet address
   * @param publicKey The wallet's public key
   * @param message The original message that was signed
   * @param signature The signature to verify
   * @returns true if signature is valid, false otherwise
   */
  verifySignature(
    publicKey: string,
    message: string,
    signature: string,
  ): Promise<boolean>;

  /**
   * Validate if a wallet address is valid for this adapter
   * @param publicKey The wallet address to validate
   * @returns true if valid, false otherwise
   */
  validateAddress(publicKey: string): boolean;

  /**
   * Get wallet info (balance, nonce, etc.)
   * @param publicKey The wallet address
   * @returns Wallet information
   */
  getWalletInfo(publicKey: string): Promise<WalletInfo>;

  /**
   * Get the network this adapter is connected to
   */
  getNetwork(): string;
}

export interface WalletInfo {
  address: string;
  balance?: string;
  nonce?: number;
  isActive: boolean;
  lastUpdated: Date;
  additionalData?: Record<string, any>;
}

export enum WalletProvider {
  STELLAR = 'stellar',
  ETHEREUM = 'ethereum',
  SOLANA = 'solana',
}
