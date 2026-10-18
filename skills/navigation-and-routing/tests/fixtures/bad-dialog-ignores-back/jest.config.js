// jest.config.js (fixture): the projects only; the Android port has started.
module.exports = {
  projects: [
    { displayName: 'unit', preset: 'jest-expo/ios' },
    { displayName: 'unit-android', preset: 'jest-expo/android' },
    { displayName: 'golden' },
  ],
};
