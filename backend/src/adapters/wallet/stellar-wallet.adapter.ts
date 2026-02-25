import { Logger } from '@nestjs/common';
import { Keypair } from 'stellar-sdk';
import {
  IWalletAdapter,
  WalletInfo,
  WalletProvider,
} from '../interfaces/wallet-adapter.interface';
import { AdapterConfig, AdapterMetadata } from '../interfaces/base-adapter.interface';

/**
 * Stellar blockchain wallet adapter.
 * Handles signature verification and wallet operations for Stellar accounts.
 */
export class StellarWalletAdapter implements IWalletAdapter {
  private readonly logger = new Logger(StellarWalletAdapter.name);
  private readonly network: string;
  private readonly config: AdapterConfig;

  constructor(network: string = 'testnet', config?: AdapterConfig) {
    this.network = network;
    this.config = {
      timeout: 5000,
      maxRetries: 3,
      ...config,
    };
  }

  getName(): string {
    return WalletProvider.STELLAR;
  }

  isConfigured(): boolean {
    // Stellar SDK is always available if imported
    return true;
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test basic keypair operations
      const testKeypair = Keypair.random();
      return testKeypair !== null;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  getMetadata(): AdapterMetadata {
    return {
      name: 'Stellar Wallet Adapter',
      version: '1.0.0',
      provider: WalletProvider.STELLAR,
      capabilities: ['signature-verification', 'address-validation', 'wallet-info'],
      isAsync: true,
      supportsRetry: true,
      supportsCircuitBreaker: false,
    };
  }

  async verifySignature(
    publicKey: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    try {
      if (!this.validateAddress(publicKey)) {
        return false;
      }

      const keypair = Keypair.fromPublicKey(publicKey);
      const messageBuffer = Buffer.from(message);
      const signatureBuffer = Buffer.from(signature, 'base64');

      const isValid = keypair.verify(messageBuffer, signatureBuffer);
      return isValid;
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      return false;
    }
  }

  validateAddress(publicKey: string): boolean {
    try {
      // Stellar public keys start with 'G' and are base32 encoded
      if (!publicKey || typeof publicKey !== 'string') {
        return false;
      }

      if (!publicKey.startsWith('G')) {
        return false;
      }

      // Try to create a keypair from the public key to validate
      Keypair.fromPublicKey(publicKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getWalletInfo(publicKey: string): Promise<WalletInfo> {
    try {
      if (!this.validateAddress(publicKey)) {
        throw new Error(`Invalid Stellar address: ${publicKey}`);
      }

      // Basic wallet info - can be extended to fetch from Stellar network
      return {
        address: publicKey,
        isActive: true,
        lastUpdated: new Date(),
        additionalData: {
          network: this.network,
          provider: WalletProvider.STELLAR,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get wallet info:', error);
      throw error;
    }
  }

  getNetwork(): string {
    return this.network;
  }
}
