// apps/__GAME_ID__/src/levels/__GAME_ID__-describe.ts
// A level start as readable text for the data goldens: the move limit and the board ('#' lit,
// '.' dark). A game with more than a grid writes its own (Line Siege: lanes, board and tray).
import { renderCells } from '@e07/game-kit/testing/render-cells.ts';

import type { __GAME_PASCAL__State } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: __GAME_PASCAL__State): string {
  return [`moves ${String(state.maxMoves)}`, renderCells(state.cells, state.cols)].join('\n');
}
