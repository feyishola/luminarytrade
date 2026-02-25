import { Injectable, Logger } from '@nestjs/common';
import { CacheManager } from './cache-manager.service';

export interface InvalidationRule {
  patterns: string[];
  namespace?: string;
}

@Injectable()
export class CacheInvalidator {
  private readonly logger = new Logger(CacheInvalidator.name);
  private readonly invalidationRules = new Map<string, InvalidationRule>();

  constructor(private readonly cacheManager: CacheManager) {
    this.initializeRules();
  }

  /**
   * Initialize default invalidation rules
   */
  private initializeRules(): void {
    // Agent-related invalidations
    this.registerRule('agent:create', {
      patterns: ['agents:*', 'agent:top-performers:*', 'agent:search:*'],
      namespace: 'agent',
    });

    this.registerRule('agent:update', {
      patterns: ['agent:*', 'agents:*', 'agent:top-performers:*'],
      namespace: 'agent',
    });

    this.registerRule('agent:delete', {
      patterns: ['agent:*', 'agents:*', 'agent:top-performers:*', 'agent:search:*'],
      namespace: 'agent',
    });

    this.registerRule('agent:performance-update', {
      patterns: ['agent:top-performers:*', 'agent:*'],
      namespace: 'agent',
    });

    // Oracle-related invalidations
    this.registerRule('oracle:snapshot', {
      patterns: ['oracle:latest', 'oracle:snapshot:*'],
      namespace: 'oracle',
    });

    this.registerRule('oracle:price-update', {
      patterns: ['oracle:latest', 'oracle:price:*'],
      namespace: 'oracle',
    });
  }

  /**
   * Register a new invalidation rule
   */
  registerRule(ruleName: string, rule: InvalidationRule): void {
    this.invalidationRules.set(ruleName, rule);
    this.logger.debug(`Registered invalidation rule: ${ruleName}`);
  }

  /**
   * Invalidate cache based on a rule
   */
  async invalidate(ruleName: string, additionalKeys?: string[]): Promise<void> {
    const rule = this.invalidationRules.get(ruleName);
    
    if (!rule) {
      this.logger.warn(`Invalidation rule not found: ${ruleName}`);
      return;
    }

    const patterns = [...rule.patterns, ...(additionalKeys || [])];
    
    await Promise.all(
      patterns.map(pattern => 
        this.cacheManager.delPattern(
          rule.namespace ? `${rule.namespace}:${pattern}` : pattern
        )
      )
    );

    this.logger.log(`Cache invalidated for rule: ${ruleName}`);
  }

  /**
   * Invalidate specific cache key
   */
  async invalidateKey(key: string, namespace?: string): Promise<void> {
    await this.cacheManager.del(key, { namespace });
    this.logger.debug(`Cache key invalidated: ${namespace ? `${namespace}:${key}` : key}`);
  }

  /**
   * Invalidate multiple keys
   */
  async invalidateKeys(keys: string[], namespace?: string): Promise<void> {
    await Promise.all(
      keys.map(key => this.cacheManager.del(key, { namespace }))
    );
    this.logger.debug(`Cache keys invalidated: ${keys.length} keys`);
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string, namespace?: string): Promise<void> {
    const fullPattern = namespace ? `${namespace}:${pattern}` : pattern;
    await this.cacheManager.delPattern(fullPattern);
    this.logger.debug(`Cache pattern invalidated: ${fullPattern}`);
  }
}
