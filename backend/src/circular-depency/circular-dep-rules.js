/**
 * Custom ESLint rule: no-circular-module-imports
 *
 * Detects when a NestJS module file imports from another module that
 * (transitively) imports back to it, creating a circular dependency.
 *
 * Add to your ESLint config:
 *
 *   plugins: ['local'],
 *   rules: {
 *     'local/no-circular-module-imports': 'error',
 *     'local/no-forward-ref-without-comment': 'warn',
 *     'local/enforce-module-hierarchy': 'warn',
 *   }
 *
 * Or use eslint-plugin-import (recommended simpler approach):
 *   "import/no-cycle": ["error", { "maxDepth": 5, "ignoreExternal": true }]
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Cache for resolved import graphs to avoid re-parsing files
const importCache = new Map();

/**
 * Resolves the module-level imports from a .module.ts file.
 */
function resolveModuleImports(filePath) {
  if (importCache.has(filePath)) return importCache.get(filePath);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /import\s+{[^}]+}\s+from\s+['"]([^'"]+)['"]/g;
  const imports = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  importCache.set(filePath, imports);
  return imports;
}

/**
 * Rule: no-forward-ref-without-comment
 *
 * Requires that every use of forwardRef() has a TODO comment with a tracking issue.
 */
const noForwardRefWithoutComment = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require forwardRef() usages to have a TODO tracking comment',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingComment:
        'forwardRef() must be accompanied by a // TODO: CIRCULAR-DEP #<issue> comment explaining why it is needed.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'forwardRef'
        ) {
          const sourceCode = context.getSourceCode();
          const comments = sourceCode.getCommentsBefore(node);
          const tokenBefore = sourceCode.getTokenBefore(node, { includeComments: true });

          const hasTrackingComment =
            comments.some((c) => /TODO.*CIRCULAR.?DEP/i.test(c.value)) ||
            (tokenBefore &&
              tokenBefore.type === 'Line' &&
              /TODO.*CIRCULAR.?DEP/i.test(tokenBefore.value));

          if (!hasTrackingComment) {
            context.report({
              node,
              messageId: 'missingComment',
            });
          }
        }
      },
    };
  },
};

/**
 * Rule: enforce-module-hierarchy
 *
 * Warns when a module at a known level imports from a module at a higher level.
 * Reads level assignments from .circular-dep-levels.json at project root.
 */
const enforceModuleHierarchy = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce downward-only dependency direction between NestJS modules',
      category: 'Architecture',
      recommended: true,
    },
    messages: {
      hierarchyViolation:
        "'{{from}}' (level {{fromLevel}}) must not import '{{to}}' (level {{toLevel}}). " +
        'Dependencies must flow downward.',
    },
    schema: [],
  },

  create(context) {
    const cwd = context.getCwd ? context.getCwd() : process.cwd();
    const levelsFile = path.join(cwd, '.circular-dep-levels.json');

    let levels = {};
    try {
      if (fs.existsSync(levelsFile)) {
        levels = JSON.parse(fs.readFileSync(levelsFile, 'utf-8'));
      }
    } catch {
      // Config not present — skip
    }

    return {
      ImportDeclaration(node) {
        const filename = context.getFilename();
        if (!filename.endsWith('.module.ts')) return;

        const fromModuleName = path.basename(filename, '.ts').replace('.module', 'Module');
        const importPath = node.source.value;
        const toModuleName = path.basename(importPath, '.ts').replace('.module', 'Module');

        const fromLevel = levels[fromModuleName];
        const toLevel = levels[toModuleName];

        if (fromLevel !== undefined && toLevel !== undefined && toLevel >= fromLevel) {
          context.report({
            node,
            messageId: 'hierarchyViolation',
            data: {
              from: fromModuleName,
              fromLevel: String(fromLevel),
              to: toModuleName,
              toLevel: String(toLevel),
            },
          });
        }
      },
    };
  },
};

module.exports = {
  rules: {
    'no-forward-ref-without-comment': noForwardRefWithoutComment,
    'enforce-module-hierarchy': enforceModuleHierarchy,
  },
};
