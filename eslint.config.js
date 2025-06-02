import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.vsix',
      '*.js',
      '!eslint.config.js',
      'webpack.config.js',
      'scripts/**',
      'configs/**',
      '.husky/**',
      'coverage/**',
      '*.d.ts',
    ],  },
  // Main configuration for TypeScript and React files
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // Base recommended rules
      ...js.configs.recommended.rules,

      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      'react/self-closing-comp': 'error',

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,

      // General fixable rules
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'quote-props': ['error', 'as-needed'],
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-extra-semi': 'error',
      semi: ['error', 'always'],
      quotes: ['error', 'single', { allowTemplateLiterals: true }],

      // Prettier compatibility
      ...prettierConfig.rules,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
