// apps/snare-snake/src/board/to-view.ts
// JS thread, pure: the final state of a move in the shape draw() reads. Digits are localised here
// (spec 7.3); the board itself never mirrors (spec 7.5).
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { touchingCells } from '@e07/snare-snake/rules/board-grid.ts';

import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';
import type { Direction, SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

/** A critter as drawn: frozen when the snake is next to it (it shows a ring). */
export type CritterView = {
  readonly id: number;
  readonly cell: number;
  readonly isFrozen: boolean;
};

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type SnareSnakeView = {
  readonly cols: number;
  readonly rows: number;
  /** The snake's cells, head first. */
  readonly snake: readonly number[];
  /** Where the head looks: the way it last moved. */
  readonly heading: Direction;
  readonly critters: readonly CritterView[];
  /** Moves left, digits already localised (the moves badge shows it). */
  readonly movesLeftText: string;
  /** The numbers of the spoken summary. */
  readonly movesLeft: number;
  readonly caught: number;
  readonly total: number;
};

/** The direction from the neck to the head ('right' for a one-segment snake). */
function headingOf(state: SnareSnakeState): Direction {
  const neck = state.snake[1];
  if (neck === undefined) return 'right';
  const head = pickAt(state.snake, 0);
  if (head === neck - state.cols) return 'up';
  if (head === neck + state.cols) return 'down';
  return head === neck - 1 ? 'left' : 'right';
}

export function toView(state: SnareSnakeState, format: ViewFormat): SnareSnakeView {
  const near = touchingCells(state, state.snake);
  const movesLeft = Math.max(0, state.maxMoves - state.moves);
  return {
    cols: state.cols,
    rows: state.rows,
    snake: state.snake,
    heading: headingOf(state),
    critters: state.critters.map((critter) => ({ ...critter, isFrozen: near.has(critter.cell) })),
    movesLeftText: format.formatNumber(movesLeft),
    movesLeft,
    caught: state.caught,
    total: state.total,
  };
}
