// apps/__GAME_ID__/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// EXPO_PUBLIC_* values are inlined at transform time but are NOT part of Metro's cache key.
// Keying the cache on the variant stops a store build from reusing test-build transforms.
config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`;

module.exports = config;
