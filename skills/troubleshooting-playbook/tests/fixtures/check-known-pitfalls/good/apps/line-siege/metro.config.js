// apps/line-siege/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Metro does not key its cache on EXPO_PUBLIC_* values: key it on the variant.
config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`;
module.exports = config;
