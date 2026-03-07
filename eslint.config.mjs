import { FlatCompat } from '@eslint/eslintrc';
import convexPlugin from '@convex-dev/eslint-plugin';
import { dirname } from 'path';
import unusedImports from 'eslint-plugin-unused-imports';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'out/**',
      'build/**',
      '.pnpm-store/**',
      'archive/**',
      'coverage/**',
      '.eslintcache',
      'next-env.d.ts',
      'convex/**/_generated/**',
      '**/*.generated.*',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  ...convexPlugin.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'comma-dangle': 'off',
      '@typescript-eslint/comma-dangle': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['convex/**/*.ts', 'convex/**/*.tsx'],
    rules: {
      '@convex-dev/explicit-table-ids': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message:
            'Dynamic imports are not allowed in convex files. Use regular imports instead.',
        },
      ],
    },
  },
];

export default eslintConfig;
