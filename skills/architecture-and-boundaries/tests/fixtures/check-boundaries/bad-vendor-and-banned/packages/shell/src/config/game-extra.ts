// packages/shell/src/config/game-extra.ts
import type { GameConfig } from './game-config.ts';

/** The runtime subset embedded as expo.extra.game. */
export type GameExtra = { readonly id: GameConfig['id'] };
