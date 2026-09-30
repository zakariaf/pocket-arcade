// packages/shell/src/config/with-shell.ts (excerpt)
export const shellPlugins = [
  ['expo-localization', { supportedLocales: ['en', 'de', 'fa', 'ckb'] }],
  ['react-native-google-mobile-ads', { iosAppId: 'ca-app-pub-3940256099942544~1458002511' }],
  'expo-iap',
] as const;
export const updates = { enabled: false } as const;
