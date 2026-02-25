/**
 * ESLint rule configuration for async/await standardization.
 *
 * Usage: import into your .eslintrc.js as:
 *
 *   const asyncRules = require('./src/common/async-error-handling/eslint/async-rules');
 *   module.exports = { rules: { ...asyncRules.rules } };
 */

module.exports = {
  rules: {
    // ─── Promise Handling ──────────────────────────────────────────────────

    /**
     * Require async functions to contain at least one await expression.
     * Prevents accidentally async functions that don't actually yield.
     */
    'require-await': 'error',

    /**
     * Ensure returned promises are awaited in try/catch blocks so errors are caught.
     */
    '@typescript-eslint/return-await': ['error', 'in-try-catch'],

    /**
     * Disallow floating (unawaited) Promises — every Promise must be awaited,
     * returned, or explicitly handled via .catch().
     */
    '@typescript-eslint/no-floating-promises': [
      'error',
      { ignoreVoid: true, ignoreIIFE: false },
    ],

    /**
     * Disallow .then()/.catch() chaining when async/await can be used.
     */
    '@typescript-eslint/prefer-promise-reject-errors': 'error',

    /**
     * Warn when Promise.all is used without error handling.
     * Consider Promise.allSettled for partial-failure tolerant parallel work.
     */
    'no-promise-executor-return': 'error',

    // ─── Async/Await Patterns ─────────────────────────────────────────────

    /**
     * Disallow await in loops — use Promise.all / parallelAll instead.
     */
    'no-await-in-loop': 'warn',

    /**
     * Prevent misuse of async in Array.forEach (forEach doesn't await).
     * Use `for...of` or `Promise.all(items.map(async ...))` instead.
     */
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'CallExpression[callee.property.name="forEach"] > :function[async=true]',
        message:
          'Avoid async callbacks in forEach. Use for...of or Promise.all(items.map(async () => ...)) instead.',
      },
      {
        selector: 'NewExpression[callee.name="Promise"] CallExpression[callee.property.name=/then|catch/]',
        message:
          'Avoid Promise chains inside Promise constructors. Use async/await instead.',
      },
    ],

    // ─── Error Handling ───────────────────────────────────────────────────

    /**
     * Disallow empty catch blocks. Every catch must either rethrow or handle.
     */
    'no-empty': ['error', { allowEmptyCatch: false }],

    /**
     * Require catch clause to bind the error variable.
     */
    '@typescript-eslint/no-unused-vars': [
      'error',
      { caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' },
    ],

    /**
     * Disallow throwing non-Error objects.
     */
    '@typescript-eslint/no-throw-literal': 'error',

    /**
     * Disallow misuse of async constructors.
     */
    'no-async-promise-executor': 'error',

    // ─── Type Safety ──────────────────────────────────────────────────────

    /**
     * Disallow any in catch — use `unknown` and narrow before accessing properties.
     */
    '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',
  },

  // ─── Code Review Checklist (inline docs) ─────────────────────────────────

  /**
   * Async Code Review Checklist:
   *
   * [ ] Every async function has meaningful error handling (try/catch or .catch)
   * [ ] No floating promises — all promises are awaited or returned
   * [ ] No await in a loop — use parallelAll / Promise.all
   * [ ] No async forEach — use for...of or Promise.all(items.map())
   * [ ] All timeouts use withTimeout() utility — no ad-hoc race conditions
   * [ ] Retryable operations use withRetry() — no manual retry loops
   * [ ] Circuit breakers registered for external service calls
   * [ ] AbortSignal / CancellationToken passed to long-running operations
   * [ ] Errors wrapped with AsyncErrorFactory.wrap() for context preservation
   * [ ] Stream operations use collectStream / batchStream — no manual iteration
   * [ ] Promise.allSettled used when partial results are acceptable
   * [ ] No raw `throw error` from unknown catch — narrow the type first
   */
};
