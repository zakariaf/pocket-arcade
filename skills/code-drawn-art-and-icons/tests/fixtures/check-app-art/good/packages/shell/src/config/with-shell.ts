// packages/shell/src/config/with-shell.ts (fixture excerpt)
import { withGameArt } from './art-config.ts';

import type { ExpoConfig } from 'expo/config';

export function withShell(game: { readonly id: string }): ExpoConfig {
  return withGameArt({ name: game.id, slug: game.id }, game.id);
}
