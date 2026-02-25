// .eslintrc.circular-deps.js
// Extend your existing ESLint config with this file:
//   extends: ['./.eslintrc.js', './.eslintrc.circular-deps.js']
//
// Or merge these rules into your main .eslintrc.js

module.exports = {
  plugins: [
    'import',
    // 'local',  // uncomment after wiring eslint-plugin-local or custom loader
  ],

  rules: {
    // ── Core circular detection via eslint-plugin-import ──────────────────────
    // This catches ALL circular import chains up to depth 5.
    // Set to 'error' in production; 'warn' during migration.
    'import/no-cycle': [
      'error',
      {
        maxDepth: 5,
        ignoreExternal: true,
        allowUnsafeDynamicCyclicDependency: false,
      },
    ],

    // ── Custom rules (enable after loading eslint-plugin-local) ───────────────
    // 'local/no-forward-ref-without-comment': 'warn',
    // 'local/enforce-module-hierarchy': 'warn',
  },

  overrides: [
    {
      // Stricter rules for module files
      files: ['**/*.module.ts'],
      rules: {
        'import/no-cycle': 'error',
      },
    },
    {
      // Relax for test files
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
      rules: {
        'import/no-cycle': 'off',
      },
    },
  ],
};
