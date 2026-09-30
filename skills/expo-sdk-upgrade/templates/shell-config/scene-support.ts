// packages/shell/src/config/scene-support.ts
// iOS scene life cycle for SDK 57 builds made with Xcode 27: expo-build-properties
// ios.enableSceneSupport (needs expo 57.0.23 or newer). A no-op from SDK 58 on: delete this file,
// its test and its call in withShell in the SDK 58 move commit.
import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];
type Options = Readonly<Record<string, unknown>>;

const BUILD_PROPERTIES = 'expo-build-properties';

function isRecord(value: unknown): value is Options {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withScene(options: unknown): Options {
  const base = isRecord(options) ? options : {};
  const ios = isRecord(base['ios']) ? base['ios'] : {};
  return { ...base, ios: { ...ios, enableSceneSupport: true } };
}

function isBuildProperties(entry: PluginEntry): boolean {
  return entry === BUILD_PROPERTIES || (Array.isArray(entry) && entry[0] === BUILD_PROPERTIES);
}

/**
 * Turns on ios.enableSceneSupport: merges it into the existing expo-build-properties entry (a second
 * entry would run the plugin twice), or appends one when the list has none.
 */
export function withSceneSupport(plugins: readonly PluginEntry[]): PluginEntry[] {
  if (!plugins.some(isBuildProperties)) {
    return [...plugins, [BUILD_PROPERTIES, withScene(undefined)]];
  }
  return plugins.map((entry) => {
    if (!isBuildProperties(entry)) {
      return entry;
    }
    const options: unknown = Array.isArray(entry) ? Reflect.get(entry, 1) : undefined;
    return [BUILD_PROPERTIES, withScene(options)];
  });
}
