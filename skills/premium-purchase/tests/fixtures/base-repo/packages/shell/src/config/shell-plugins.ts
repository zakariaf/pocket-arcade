// packages/shell/src/config/shell-plugins.ts (fixture: only the plugin list matters here)
export function shellPlugins(): unknown[] {
  return ['expo-sqlite', ['expo-build-properties', { android: { kotlinVersion: '2.1.20' } }], 'expo-iap'];
}
