// jest.sim.config.js — bot simulations only (`npm run test:sim`). Never part of pre-commit or `npm test`.
// Plain Node environment: a sim that needs a React Native mock is a bug (rules must be pure TS).
process.env.TZ = 'UTC';

/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  displayName: 'sim',
  preset: 'jest-expo/ios',
  testMatch: [
    '<rootDir>/{apps,packages}/*/src/**/*.sim.test.ts',
    '<rootDir>/test/**/*.sim.test.ts',
  ],
  transform: {
    '\\.ts$': ['babel-jest', { caller: { name: 'metro', bundler: 'metro', platform: 'ios' } }],
  },
  moduleNameMapper: {
    '^@e07/(game-kit|shell|tooling)/(.*)$': '<rootDir>/packages/$1/src/$2',
    '^@e07/([^/]+)/(.*)$': '<rootDir>/apps/$1/src/$2',
  },
  modulePathIgnorePatterns: [
    '<rootDir>/apps/[^/]+/(ios|android|build)/',
    '<rootDir>/(skills|\\.claude|\\.stryker-tmp)/',
  ],
  testTimeout: 300_000,
};
