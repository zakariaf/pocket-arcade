// apps/tap-flip/game.config.ts
// Stand-in for the new-game-scaffold's game config: only what check-game-host reads (the continue
// and hint settings it cross-checks against the rules).
import type { GameConfig } from '@e07/shell/config/game-config.ts';

export const gameConfig: Pick<GameConfig, 'id' | 'hints' | 'isContinueAllowed'> = {
  id: 'tap-flip',
  hints: { freePerDay: 0 },
  isContinueAllowed: true,
};
