// packages/shell/src/config/shell-plugins.ts
import { AUDIO_API_PLUGIN } from './audio-config.ts';

import type { ExpoConfig } from 'expo/config';

/** Excerpt: the native plugin list every app gets (withShell spreads it). */
export function shellPlugins(): NonNullable<ExpoConfig['plugins']> {
  return [AUDIO_API_PLUGIN];
}
