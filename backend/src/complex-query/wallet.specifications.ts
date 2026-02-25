import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../../core/specification.abstract';
import { ActiveEntitiesSpec } from '../../common/active-entities.specification';

export interface Wallet {
  id: string;
  address: string;
  isActive: boolean;
  isTrusted: boolean;
  balance: number;
  ownerId: string;
  network: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

/**
 * Filters wallets that have been marked as trusted.
 */
export class TrustedWalletsSpec extends Specification<Wallet> {
  constructor() {
    super({
      name: 'TrustedWallets',
      description: 'Wallets with isTrusted = true',
      indexHints: ['idx_wallet_trusted'],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.isTrusted = :trustedWalletsIsTrusted`,
      parameters: { trustedWalletsIsTrusted: true },
    };
  }

  isSatisfiedBy(candidate: Partial<Wallet>): boolean {
    return candidate.isTrusted === true;
  }
}

/**
 * Filters wallets with sufficient balance.
 */
export class WalletHasSufficientBalanceSpec extends Specification<Wallet> {
  constructor(private readonly minBalance: number) {
    super({
      name: `WalletSufficientBalance(min=${minBalance})`,
      description: `Wallets with balance >= ${minBalance}`,
      indexHints: ['idx_wallet_balance'],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.balance >= :minWalletBalance`,
      parameters: { minWalletBalance: this.minBalance },
    };
  }

  isSatisfiedBy(candidate: Partial<Wallet>): boolean {
    return (candidate.balance ?? 0) >= this.minBalance;
  }
}

/**
 * Filters wallets on a specific network.
 */
export class WalletOnNetworkSpec extends Specification<Wallet> {
  constructor(private readonly network: string) {
    super({
      name: `WalletOnNetwork(${network})`,
      description: `Wallets on network: ${network}`,
      indexHints: ['idx_wallet_network'],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.network = :walletNetwork`,
      parameters: { walletNetwork: this.network },
    };
  }

  isSatisfiedBy(candidate: Partial<Wallet>): boolean {
    return candidate.network === this.network;
  }
}

export class ActiveWalletsSpec extends ActiveEntitiesSpec<Wallet> {
  constructor() {
    super('isActive');
    Object.assign(this.metadata, { name: 'ActiveWallets' });
  }
}

/**
 * Composite: active AND trusted wallets — commonly used together.
 */
export class ActiveTrustedWalletsSpec extends Specification<Wallet> {
  private readonly composite = new ActiveWalletsSpec().and(new TrustedWalletsSpec());

  constructor() {
    super({
      name: 'ActiveTrustedWallets',
      description: 'Wallets that are both active and trusted',
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return this.composite.toQuery(context);
  }

  isSatisfiedBy(candidate: Partial<Wallet>): boolean {
    return candidate.isActive === true && candidate.isTrusted === true;
  }
}
