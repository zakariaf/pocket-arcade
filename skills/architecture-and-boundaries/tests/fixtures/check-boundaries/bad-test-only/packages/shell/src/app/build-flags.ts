// packages/shell/src/app/build-flags.ts
export const IS_TEST_BUILD = process.env.EXPO_PUBLIC_APP_VARIANT !== 'store';
