// Core
export { Specification, QueryContext, SpecificationQuery, JoinClause, OrderByClause, PaginationOptions, SpecificationMetadata } from './core/specification.abstract';
export { PaginatedSpecification, PaginatedResult } from './core/paginated-specification';
export { SpecificationExecutor, ExecutionOptions, ExplainResult } from './core/specification-executor';

// Composites
export { AndSpecification } from './core/composite/and.specification';
export { OrSpecification } from './core/composite/or.specification';
export { NotSpecification } from './core/composite/not.specification';

// Common / Generic Specifications
export { ActiveEntitiesSpec, HasIsActive } from './common/active-entities.specification';
export { ByIdSpec, HasId } from './common/by-id.specification';
export { CreatedAfterSpec, UpdatedWithinDaysSpec, HasCreatedAt } from './common/created-after.specification';
export { RelatedToSpec, OwnedBySpec } from './common/related-to.specification';

// Domain — Agents
export {
  Agent,
  ActiveAgentsSpec,
  HighScoreAgentsSpec,
  RecentlyUpdatedSpec,
  AgentOwnedBySpec,
  AgentHasTagSpec,
  AgentHasWalletSpec,
  AgentSpecificationBuilder,
} from './domain/agents/agent.specifications';

// Domain — Wallets
export {
  Wallet,
  TrustedWalletsSpec,
  WalletHasSufficientBalanceSpec,
  WalletOnNetworkSpec,
  ActiveWalletsSpec,
  ActiveTrustedWalletsSpec,
} from './domain/wallets/wallet.specifications';

// Validation & Cache
export { SpecificationValidator, ValidationResult, LintRule } from './validation/specification-validator';
export { SpecificationCache } from './cache/specification-cache';

// Module
export { SpecificationModule } from './specification.module';
