// eslint.config.mjs (excerpt)
import jestPlugin from 'eslint-plugin-jest';

export default [
  {
    files: ['**/*.test.{ts,tsx}'],
    extends: [jestPlugin.configs['flat/recommended'], jestPlugin.configs['flat/style']],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      complexity: ['error', { max: 10, variant: 'modified' }],
      'sonarjs/cognitive-complexity': ['error', 15],
    },
  },
];
