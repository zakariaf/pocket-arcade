const SHARED = {
  preset: 'jest-expo/ios',
  setupFiles: ['<rootDir>/packages/shell/src/i18n/intl-polyfills.ts'],
};
module.exports = { projects: [{ ...SHARED, displayName: 'unit' }] };
