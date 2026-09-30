// packages/shell/src/config/with-shell.ts (excerpt)
export const shellPlugins = [
  ['expo-localization', { supportedLocales: ['en', 'de', 'fa', 'ckb'], supportsRTL: true }],
  ['react-native-google-mobile-ads', { iosAppId: 'x', userTrackingUsageDescription: 'Ads' }],
  ['expo-iap', { iapkitApiKey: 'k' }],
] as const;
