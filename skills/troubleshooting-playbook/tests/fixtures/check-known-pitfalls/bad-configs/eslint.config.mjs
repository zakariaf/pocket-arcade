// eslint.config.mjs (excerpt)
import jestPlugin from 'eslint-plugin-jest';

export default [
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { ...jestPlugin.configs['flat/recommended'], ...jestPlugin.configs['flat/style'] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'sonarjs/cognitive-complexity': ['error', 15],
      complexity: ['error', 10],
    },
  },
];
