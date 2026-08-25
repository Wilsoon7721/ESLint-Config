import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import { rules as local } from './rules.js';

export default tseslint.config({
  files: ['**/*.{js,jsx,ts,tsx}'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { '@stylistic': stylistic, local: { rules: local } },
  rules: {
    'local/short-if-body': 'error',
    'local/concise-arrow-body': 'error',
    'local/collapse-tagged-template': 'error',
    '@stylistic/padding-line-between-statements': ['error', { blankLine: 'always', prev: 'if', next: '*' }],
  },
});