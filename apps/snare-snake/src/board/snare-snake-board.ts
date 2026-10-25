// apps/snare-snake/src/board/snare-snake-board.ts
import { targetOf } from '@e07/snare-snake/rules/steering.ts';

import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { SnareSnakeView } from './to-view.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { GameBoard } from '@e07/shell/game-host/board-types.ts';
import type { SnareSnakeMove, SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

/** The cell a turn moves the head into: the host rings it when that turn is the hint. */
function targetsOfMove(state: SnareSnakeState, move: SnareSnakeMove): readonly BoardTarget[] {
  const cell = targetOf(state, move.direction);
  if (cell === null) return [];
  return [{ regionId: 'board', col: cell % state.cols, row: Math.floor(cell / state.cols) }];
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const snareSnakeBoard: GameBoard<
  SnareSnakeState,
  SnareSnakeView,
  BoardToken,
  SnareSnakeMove
> = {
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  // Every shape is a circle, a rounded rect or a line: no unit paths to build.
  buildPaths: () => ({}),
  describe: (view) => ({
    id: 'snare-snake.board.summary',
    values: { caught: view.caught, total: view.total, movesLeft: view.movesLeft },
  }),
  targetsOfMove,
};
