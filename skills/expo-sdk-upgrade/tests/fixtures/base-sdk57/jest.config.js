// jest.config.js (fixture excerpt)
const WORKSPACE_MODULES = {
  '^@e07/(game-kit|shell|tooling)/(.*)$': '<rootDir>/packages/$1/src/$2',
};

const SHARED = {
  rootDir: __dirname,
  preset: 'jest-expo/ios',
  moduleNameMapper: WORKSPACE_MODULES,
};

module.exports = { projects: [{ ...SHARED, displayName: 'unit' }] };
