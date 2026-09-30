// packages/shell/src/config/shell-plugins.ts
/** The plugin list the composer passes to Expo (named by path string, loaded by Node). */
export type PluginEntry = string | readonly [string, unknown];

export const SHELL_PLUGINS: readonly PluginEntry[] = ['expo-sqlite'];
