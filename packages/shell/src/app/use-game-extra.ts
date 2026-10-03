// packages/shell/src/app/use-game-extra.ts
// The game's runtime config (expo.extra.game, written by withShell) for model hooks: the level
// count, the modes, the ad policy numbers and the links. Read and validated once per mounted
// screen; it never changes during the life of a build.
import { useState } from 'react';

import { readGameExtra } from '@e07/shell/app/read-game-extra.ts';

import type { GameExtra } from '@e07/shell/config/game-extra.ts';

export function useGameExtra(): GameExtra {
  const [extra] = useState(() => readGameExtra());
  return extra;
}

/** Every level the game ships ("Play – Level 13" never goes past the last one). */
export function levelCountOf(extra: GameExtra): number {
  return extra.levels.packCount * extra.levels.levelsPerPack;
}
