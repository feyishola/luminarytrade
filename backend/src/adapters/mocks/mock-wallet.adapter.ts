import {
  IWalletAdapter,
  WalletInfo,
  WalletProvider,
} from '../interfaces/wallet-adapter.interface';
import { AdapterMetadata } from '../interfaces/base-adapter.interface';

/**
 * Mock Wallet Adapter for Testing
 * Simulates wallet operations without external dependencies
 */
export class MockWalletAdapter implements IWalletAdapter {
  private validAddresses = new Set<string>();
  private signatures = new Map<string, { message: string; isValid: boolean }>();

  constructor() {
    this.initializeTestData();
  }

  private initializeTestData(): void {
    // Add test addresses
    this.validAddresses.add('GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IYJJX2VY2YLGRZSXBJJMA');
    this.validAddresses.add('GBXEJCQVGSN5PNMFJ2IBRP5JYMNDXV4Y7XZPBWVTJFIBCVPXNQ3VHSA');

    // Add test signatures
    this.signatures.set('valid-signature', {
      message: 'test-message',
      isValid: true,
    });
    this.signatures.set('invalid-signature', {
      message: 'test-message',
      isValid: false,
    });
  }

  getName(): string {
    return WalletProvider.STELLAR;
  }

  isConfigured(): boolean {
    return true;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  getMetadata(): AdapterMetadata {
    return {
      name: 'Mock Wallet Adapter',
      version: '1.0.0',
      provider: WalletProvider.STELLAR,
      capabilities: ['signature-verification', 'address-validation'],
      isAsync: true,
      supportsRetry: false,
      supportsCircuitBreaker: false,
    };
  }

  async verifySignature(
    publicKey: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    // Mock signature verification
    if (!this.validateAddress(publicKey)) {
      return false;
    }

    const signatureData = this.signatures.get(signature);
    if (!signatureData) {
      return false;
    }

    return signatureData.isValid && signatureData.message === message;
  }

  validateAddress(publicKey: string): boolean {
    return this.validAddresses.has(publicKey);
  }

  async getWalletInfo(publicKey: string): Promise<WalletInfo> {
    if (!this.validateAddress(publicKey)) {
      throw new Error(`Invalid address: ${publicKey}`);
    }

    return {
      address: publicKey,
      balance: '1000.00',
      nonce: 1,
      isActive: true,
      lastUpdated: new Date(),
      additionalData: {
        network: 'testnet',
        provider: WalletProvider.STELLAR,
      },
    };
  }

  getNetwork(): string {
    return 'testnet';
  }

  /**
   * Test helper: Add a valid address
   */
  addValidAddress(address: string): void {
    this.validAddresses.add(address);
  }

  /**
   * Test helper: Add a valid signature
   */
  addValidSignature(
    signature: string,
    message: string,
    isValid: boolean = true,
  ): void {
    this.signatures.set(signature, { message, isValid });
  }
}
