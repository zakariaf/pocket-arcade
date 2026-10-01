// packages/shell/src/config/shell-plugins.ts (excerpt): Google's ads SDK without the tracking entry.
export const SHELL_PLUGINS = [
  ['expo-localization', { supportedLocales: ['en', 'de', 'fa', 'ckb'] }],
  ['react-native-google-mobile-ads', { iosAppId: 'x' }],
] as const;
