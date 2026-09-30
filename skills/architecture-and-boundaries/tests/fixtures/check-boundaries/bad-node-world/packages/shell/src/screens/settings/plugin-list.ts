// packages/shell/src/screens/settings/plugin-list.ts
import type { PluginEntry } from '@demo/shell/config/shell-plugins.ts';

/** Wrong on purpose: a type-only import from the config composer still drags it into the app program. */
export type ShownPlugin = PluginEntry;
