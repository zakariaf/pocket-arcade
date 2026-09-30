// jest.config.js (excerpt)
module.exports = {
  preset: 'jest-expo/ios',
  testEnvironment: '@shopify/react-native-skia/jestEnv.js',
  coverageThreshold: {
    './packages/shell/src/services/save/': { lines: 95 },
  },
};
