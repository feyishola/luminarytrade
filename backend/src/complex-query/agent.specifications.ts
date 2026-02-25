import {
  Specification,
  QueryContext,
  SpecificationQuery,
} from '../../core/specification.abstract';
import { ActiveEntitiesSpec } from '../../common/active-entities.specification';
import { OwnedBySpec } from '../../common/related-to.specification';
import { UpdatedWithinDaysSpec } from '../../common/created-after.specification';

// ─── Domain Interface ─────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  isActive: boolean;
  score: number;
  ownerId: string;
  updatedAt: Date;
  createdAt: Date;
  walletAddress?: string;
  tags?: string[];
}

// ─── Individual Agent Specifications ─────────────────────────────────────────

/**
 * Filters active agents (isActive = true).
 */
export class ActiveAgentsSpec extends ActiveEntitiesSpec<Agent> {
  constructor() {
    super('isActive');
    Object.assign(this, {
      metadata: {
        ...this.metadata,
        name: 'ActiveAgents',
        description: 'Agents with isActive flag set to true',
      },
    });
  }
}

/**
 * Filters agents with a score at or above the given threshold.
 */
export class HighScoreAgentsSpec extends Specification<Agent> {
  constructor(private readonly minScore: number) {
    super({
      name: `HighScoreAgents(min=${minScore})`,
      description: `Agents with score >= ${minScore}`,
      indexHints: ['idx_agent_score'],
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.score >= :highScoreMin`,
      parameters: { highScoreMin: this.minScore },
    };
  }

  isSatisfiedBy(candidate: Partial<Agent>): boolean {
    return (candidate.score ?? 0) >= this.minScore;
  }
}

/**
 * Filters agents updated within the last N days.
 */
export class RecentlyUpdatedSpec extends UpdatedWithinDaysSpec<Agent> {
  constructor(days: number) {
    super(days);
    Object.assign(this.metadata, {
      name: `RecentlyUpdatedAgents(${days}d)`,
      description: `Agents updated within the last ${days} days`,
    });
  }
}

/**
 * Filters agents owned by a specific user.
 */
export class AgentOwnedBySpec extends OwnedBySpec<Agent> {
  constructor(userId: string) {
    super(userId);
    Object.assign(this.metadata, { name: `AgentOwnedBy(${userId})` });
  }
}

/**
 * Filters agents by a tag.
 */
export class AgentHasTagSpec extends Specification<Agent> {
  constructor(private readonly tag: string) {
    super({
      name: `AgentHasTag(${tag})`,
      description: `Agents tagged with "${tag}"`,
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `:agentTag = ANY(${context.alias}.tags)`,
      parameters: { agentTag: this.tag },
    };
  }

  isSatisfiedBy(candidate: Partial<Agent>): boolean {
    return candidate.tags?.includes(this.tag) ?? false;
  }
}

/**
 * Filters agents with a wallet address set.
 */
export class AgentHasWalletSpec extends Specification<Agent> {
  constructor() {
    super({
      name: 'AgentHasWallet',
      description: 'Agents that have a wallet address',
    });
  }

  toQuery(context: QueryContext): SpecificationQuery {
    return {
      where: `${context.alias}.walletAddress IS NOT NULL`,
    };
  }

  isSatisfiedBy(candidate: Partial<Agent>): boolean {
    return !!candidate.walletAddress;
  }
}

// ─── Composite Factory ────────────────────────────────────────────────────────

/**
 * Fluent builder for complex agent queries.
 *
 * @example
 * const spec = AgentSpecificationBuilder.create()
 *   .active()
 *   .highScore(80)
 *   .recentlyUpdated(7)
 *   .ownedBy(userId)
 *   .build()
 *   .paginate(1, 20);
 */
export class AgentSpecificationBuilder {
  private spec: Specification<Agent> | null = null;

  static create(): AgentSpecificationBuilder {
    return new AgentSpecificationBuilder();
  }

  active(): this {
    this.chain(new ActiveAgentsSpec());
    return this;
  }

  highScore(minScore: number): this {
    this.chain(new HighScoreAgentsSpec(minScore));
    return this;
  }

  recentlyUpdated(days: number): this {
    this.chain(new RecentlyUpdatedSpec(days));
    return this;
  }

  ownedBy(userId: string): this {
    this.chain(new AgentOwnedBySpec(userId));
    return this;
  }

  withTag(tag: string): this {
    this.chain(new AgentHasTagSpec(tag));
    return this;
  }

  withWallet(): this {
    this.chain(new AgentHasWalletSpec());
    return this;
  }

  build(): Specification<Agent> {
    if (!this.spec) {
      throw new Error(
        'AgentSpecificationBuilder: no criteria added. Call at least one filter method.',
      );
    }
    return this.spec;
  }

  private chain(next: Specification<Agent>): void {
    this.spec = this.spec ? this.spec.and(next) : next;
  }
}
