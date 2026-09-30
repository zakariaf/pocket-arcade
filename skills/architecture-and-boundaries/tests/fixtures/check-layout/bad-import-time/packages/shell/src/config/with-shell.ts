// packages/shell/src/config/with-shell.ts
import { withInfoPlist } from 'expo/config-plugins.js';

import type { GameConfig } from './game-config.ts';

/** The config composer. */
export function withShell(game: GameConfig, env: unknown): unknown {
  return withInfoPlist({ name: game.id, env }, (next) => next);
}
