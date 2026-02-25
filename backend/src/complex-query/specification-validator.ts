import { Injectable, Logger } from '@nestjs/common';
import { Specification } from '../core/specification.abstract';
import { AndSpecification } from '../core/composite/and.specification';
import { NotSpecification } from '../core/composite/not.specification';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface LintRule<T = unknown> {
  name: string;
  description: string;
  check(spec: Specification<T>, result: ValidationResult): void;
}

/**
 * Validates specifications before execution.
 * Detects redundant criteria, incompatible specs, and optimization opportunities.
 */
@Injectable()
export class SpecificationValidator {
  private readonly logger = new Logger(SpecificationValidator.name);
  private readonly rules: LintRule[] = [];

  constructor() {
    this.registerDefaultRules();
  }

  validate<T>(spec: Specification<T>): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    this.runLintRules(spec, result);

    if (result.errors.length > 0) {
      result.isValid = false;
    }

    return result;
  }

  registerRule<T>(rule: LintRule<T>): this {
    this.rules.push(rule as LintRule);
    return this;
  }

  private runLintRules<T>(spec: Specification<T>, result: ValidationResult): void {
    for (const rule of this.rules) {
      try {
        rule.check(spec as Specification<unknown>, result);
      } catch (err) {
        this.logger.error(`Lint rule "${rule.name}" threw an error`, err);
      }
    }
  }

  private registerDefaultRules(): void {
    // Rule: Detect double negation — NOT(NOT(X))
    this.registerRule({
      name: 'no-double-negation',
      description: 'Flags NOT(NOT(spec)) which can be simplified to spec',
      check(spec, result) {
        if (
          spec instanceof NotSpecification &&
          spec.inner instanceof NotSpecification
        ) {
          result.warnings.push(
            `Double negation detected in "${spec.metadata.name}". ` +
              `Consider replacing NOT(NOT(x)) with x directly.`,
          );
          result.suggestions.push(
            `Use the inner spec "${spec.inner.inner.metadata.name}" directly.`,
          );
        }
      },
    });

    // Rule: Warn on unbounded queries (no WHERE clause)
    this.registerRule({
      name: 'no-unbounded-query',
      description: 'Warns when a specification produces no WHERE clause',
      check(spec, result) {
        try {
          const ctx = { alias: 'entity', addedJoins: new Set<string>(), parameterIndex: 0 };
          const query = spec.toQuery(ctx);
          if (!query.where || query.where.trim() === '') {
            result.warnings.push(
              `Specification "${spec.metadata.name}" generates no WHERE clause — ` +
                `this will fetch ALL rows. Intentional?`,
            );
          }
        } catch {
          // Spec may require specific context; skip
        }
      },
    });

    // Rule: Detect duplicate spec names in AND chain (redundant criteria)
    this.registerRule({
      name: 'no-redundant-criteria',
      description: 'Detects duplicate specifications in an AND chain',
      check(spec, result) {
        if (spec instanceof AndSpecification) {
          const leaves = spec.flatten();
          const names = leaves.map((s) => s.metadata.name);
          const seen = new Set<string>();
          for (const name of names) {
            if (seen.has(name)) {
              result.warnings.push(
                `Redundant specification detected: "${name}" appears more than once in an AND chain.`,
              );
            }
            seen.add(name);
          }
        }
      },
    });

    // Rule: Warn when required relations are declared but possibly missing joins
    this.registerRule({
      name: 'required-relations-declared',
      description: 'Ensures specifications declare required relations',
      check(spec, result) {
        const required = spec.metadata.requiredRelations ?? [];
        if (required.length > 0) {
          result.suggestions.push(
            `Specification "${spec.metadata.name}" requires relations: ${required.join(', ')}. ` +
              `Ensure these are eager-loaded or joined.`,
          );
        }
      },
    });

    // Rule: Suggest index hints when available
    this.registerRule({
      name: 'index-hint-suggestion',
      description: 'Surfaces index hints embedded in specification metadata',
      check(spec, result) {
        const hints = spec.metadata.indexHints ?? [];
        if (hints.length > 0) {
          result.suggestions.push(
            `Specification "${spec.metadata.name}" suggests using indexes: ${hints.join(', ')}.`,
          );
        }
      },
    });
  }
}
