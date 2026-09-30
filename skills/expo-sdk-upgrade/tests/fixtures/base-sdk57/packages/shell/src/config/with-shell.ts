// packages/shell/src/config/with-shell.ts (excerpt for the fixture)
import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

export function shellPlugins(): PluginEntry[] {
  return ['expo-sqlite', ['expo-localization', { supportedLocales: { ios: ['en'], android: ['en'] } }]];
}
