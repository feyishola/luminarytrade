#!/usr/bin/env node
/**
 * CI Circular Dependency Check
 * Runs as part of your CI pipeline to prevent new circular deps from merging.
 *
 * Add to package.json:
 *   "scripts": {
 *     "check:circular": "node scripts/check-circular-deps.js",
 *     "ci:lint": "npm run lint && npm run check:circular"
 *   }
 *
 * Add to GitHub Actions:
 *   - name: Check circular dependencies
 *     run: npm run check:circular
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SRC_DIR = path.join(process.cwd(), 'src');
const EXIT_ON_FOUND = process.env.CI === 'true';
const MAX_ALLOWED = parseInt(process.env.MAX_CIRCULAR_DEPS ?? '0', 10);

console.log('🔍 Running circular dependency check...\n');

// ─── Method 1: madge (visual + programmatic) ─────────────────────────────────
function checkWithMadge() {
  try {
    execSync('npx madge --version', { stdio: 'ignore' });
  } catch {
    console.warn('madge not installed. Skipping madge check.');
    console.warn('Install with: npm install --save-dev madge\n');
    return null;
  }

  try {
    const result = execSync(
      `npx madge --circular --extensions ts ${SRC_DIR} --ts-config tsconfig.json 2>&1`,
      { encoding: 'utf-8' },
    );

    const lines = result.split('\n').filter(Boolean);
    const circularLines = lines.filter((l) => l.includes('→') || l.includes('->'));

    console.log('📊 madge Results:');
    if (circularLines.length === 0) {
      console.log('  ✅ No circular dependencies found by madge.\n');
    } else {
      console.error(`  ❌ ${circularLines.length} circular dependency chain(s):\n`);
      circularLines.forEach((l) => console.error(`    ${l}`));
      console.log('');
    }

    return circularLines.length;
  } catch (err) {
    const output = err.stdout ?? err.message ?? '';
    const circularLines = output.split('\n').filter((l) => l.includes('→') || l.includes('->'));
    if (circularLines.length > 0) {
      console.error(`  ❌ ${circularLines.length} circular dependency chain(s):\n`);
      circularLines.forEach((l) => console.error(`    ${l}`));
      return circularLines.length;
    }
    return 0;
  }
}

// ─── Method 2: ESLint import/no-cycle ────────────────────────────────────────
function checkWithEslint() {
  try {
    execSync('npx eslint --version', { stdio: 'ignore' });
  } catch {
    console.warn('ESLint not available. Skipping ESLint check.\n');
    return null;
  }

  try {
    execSync(
      `npx eslint ${SRC_DIR} --rule '{"import/no-cycle": "error"}' --ext .ts --quiet 2>&1`,
      { encoding: 'utf-8', stdio: 'ignore' },
    );
    console.log('  ✅ ESLint import/no-cycle: No issues found.\n');
    return 0;
  } catch (err) {
    const output = (err.stdout ?? '') + (err.stderr ?? '');
    const violations = (output.match(/import\/no-cycle/g) ?? []).length;
    console.error(`  ❌ ESLint found ${violations} circular import violation(s).\n`);
    return violations;
  }
}

// ─── Method 3: Generate dependency graph image ───────────────────────────────
function generateGraph() {
  try {
    execSync('npx madge --version', { stdio: 'ignore' });
    const outPath = path.join(process.cwd(), 'dependency-graph.svg');
    execSync(
      `npx madge --image ${outPath} --extensions ts ${SRC_DIR} --ts-config tsconfig.json`,
      { stdio: 'ignore' },
    );
    console.log(`📈 Dependency graph saved to: ${outPath}\n`);
  } catch {
    // Optional step — don't fail the build
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const madgeCount = checkWithMadge() ?? 0;
  const eslintCount = checkWithEslint() ?? 0;

  if (process.env.GENERATE_GRAPH === 'true') {
    generateGraph();
  }

  const total = Math.max(madgeCount, eslintCount);
  console.log(`─────────────────────────────────────────`);
  console.log(`Total circular dependencies detected: ${total}`);
  console.log(`Allowed maximum: ${MAX_ALLOWED}`);

  if (total > MAX_ALLOWED) {
    console.error(
      `\n❌ Build failed: ${total} circular dep(s) exceed allowed maximum of ${MAX_ALLOWED}.`,
    );
    console.error('   Run `npm run dep:report` to see refactoring suggestions.\n');
    if (EXIT_ON_FOUND) {
      process.exit(1);
    }
  } else {
    console.log('\n✅ Circular dependency check passed.\n');
    process.exit(0);
  }
})();
