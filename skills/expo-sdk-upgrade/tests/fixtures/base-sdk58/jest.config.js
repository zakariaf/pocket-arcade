// jest.config.js (fixture excerpt)
const WORKSPACE_MODULES = {
  '^react-native/asset-registry$': '<rootDir>/node_modules/react-native/src/asset-registry.js',
  '^@e07/(game-kit|shell|tooling)/(.*)$': '<rootDir>/packages/$1/src/$2',
};

const SHARED = {
  rootDir: __dirname,
  preset: 'jest-expo/ios',
  resolver: 'react-native-reanimated/jest/resolver',
  moduleNameMapper: WORKSPACE_MODULES,
};

module.exports = { projects: [{ ...SHARED, displayName: 'unit' }] };
