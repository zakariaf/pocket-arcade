// jest.config.js (excerpt)
const fs = require('node:fs');

const LOGIC_THRESHOLDS = { './packages/game-kit/src/': 'packages/game-kit/src/**/*.ts' };
const coverageThreshold = Object.fromEntries(
  Object.entries(LOGIC_THRESHOLDS).filter(([, glob]) => fs.globSync(glob).length > 0).map(([key]) => [key, { lines: 95 }]),
);

// Skill templates and fixtures ship __mocks__ with the app's names: Jest never sees them.
const IGNORED_PATHS = ['<rootDir>/(coverage|reports|tools|skills|\\.claude|\\.stryker-tmp)/'];

module.exports = {
  modulePathIgnorePatterns: IGNORED_PATHS,
  projects: [
    { displayName: 'unit', preset: 'jest-expo/ios' },
    { displayName: 'golden', testEnvironment: '@shopify/react-native-skia/jestEnv.js' },
  ],
  coverageThreshold,
};
