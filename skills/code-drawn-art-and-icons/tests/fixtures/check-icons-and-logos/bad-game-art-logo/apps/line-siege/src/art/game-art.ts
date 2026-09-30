// apps/line-siege/src/art/game-art.ts
import { BOARD_PALETTES } from '@e07/line-siege/board/board-palettes.ts';

import type { BoardToken } from '@e07/line-siege/board/board-palettes.ts';
import type { CreditEntry } from '@e07/shell/art/credit-entry.ts';
import type { GameArt } from '@e07/shell/art/game-art.ts';

/** S11d rows of the game's own assets (a word list, for example); [] when it has none. */
const CREDITS: readonly CreditEntry[] = [];

/** presentation.art: the board palettes, the one logo every picture of the game uses, the credits. */
export const GAME_ART: GameArt<BoardToken> = {
  palettes: BOARD_PALETTES,
  logo: { layers: [] },
  credits: CREDITS,
};
