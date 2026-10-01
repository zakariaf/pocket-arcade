// packages/shell/src/config/shell-plugins.ts (excerpt): the ads SDK with the tracking permission.
export const SHELL_PLUGINS = [
  ['expo-localization', { supportedLocales: ['en', 'de', 'fa', 'ckb'] }],
  ['react-native-google-mobile-ads', { iosAppId: 'ca-app-pub-3940256099942544~1458002511' }],
  ['expo-tracking-transparency', { userTrackingPermission: 'Google uses this to show you ads that fit your interests.' }],
] as const;
