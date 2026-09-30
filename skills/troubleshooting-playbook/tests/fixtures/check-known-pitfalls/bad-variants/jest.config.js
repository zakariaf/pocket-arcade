// jest.config.js (excerpt)
const fs = require('node:fs');

const LOGIC_THRESHOLDS = { './packages/game-kit/src/': 'packages/game-kit/src/**/*.ts' };
const coverageThreshold = Object.fromEntries(
  Object.entries(LOGIC_THRESHOLDS).filter(([, glob]) => fs.globSync(glob).length > 0).map(([key]) => [key, { lines: 95 }]),
);

module.exports = {
  projects: [
    { displayName: 'unit', preset: 'jest-expo/ios' },
    { displayName: 'golden', testEnvironment: '@shopify/react-native-skia/jestEnv.js' },
  ],
  coverageThreshold,
};
