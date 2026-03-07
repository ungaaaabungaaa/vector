import convexPlugin from '@convex-dev/eslint-plugin';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';
import unusedImports from 'eslint-plugin-unused-imports';

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
  ...nextCoreWebVitals,
  ...convexPlugin.configs.recommended,
  prettier,
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
