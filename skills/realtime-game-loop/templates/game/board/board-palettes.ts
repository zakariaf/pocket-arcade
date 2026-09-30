// apps/__GAME_ID__/src/board/board-palettes.ts
import palettes from './board-palettes.json' with { type: 'json' };

import type { PaletteSet } from '@e07/shell/game-host/board-kit.ts';

/** Semantic colour tokens of the board; the values live in board-palettes.json. */
export type BoardToken = keyof typeof palettes.light;

/** light / dark / colour-blind light / colour-blind dark, checked against the PaletteSet shape. */
export const BOARD_PALETTES: PaletteSet<BoardToken> = palettes;
