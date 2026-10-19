// packages/shell/src/game-host/coach-pointer.ts
// The tutorial's one pointer (spec S13) as the board shows it: the cells it marks and where the
// pointing hand goes. A drag pointer names only its two ends (the tray slot and the cell the block
// drops on), but a block may cover more cells: the game itself says which, by turning the drag into
// its move (intentToMove, the same rule a player's drag follows) and the move into the cells it
// fills (board.targetsOfMove). So every cell of the gap is marked, never only the one the drag ends
// on, which would show a gap smaller than the block. Pure, so plain Jest proves it.
import type { CoachHand } from './draw-coach-hand.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

export type CoachPointer = {
  /** The cells the board marks with the hinted ones: the slot and every cell the move fills. */
  readonly cells: readonly BoardTarget[];
  /** The hand the board draws over its picture, or null (no pointer on the board). */
  readonly hand: CoachHand | null;
};

/** No pointer on the board (a top-bar pointer, none, or a stage without one). */
export const NO_COACH: CoachPointer = { cells: [], hand: null };

/**
 * What the pointer needs from the game: its intent rule and, optionally, a move's cells (undefined
 * when the game cannot name them).
 */
export type CoachGame<TState, TMove> = {
  readonly intentToMove: (state: TState, intent: InputIntent) => TMove | null;
  readonly targetsOfMove?: (state: TState, move: TMove) => readonly BoardTarget[] | undefined;
};

/** The parts of a game module the pointer reads (its engine and its board). */
export type CoachModule<TState, TMove> = {
  readonly engine: Pick<CoachGame<TState, TMove>, 'intentToMove'>;
  readonly presentation: {
    readonly board: { targetsOfMove?(state: TState, move: TMove): readonly BoardTarget[] };
  };
};

/** The pointer's rule from a game module: a drag becomes its own move, the move its cells. */
export function coachGameOf<TState, TMove>(
  game: CoachModule<TState, TMove>,
): CoachGame<TState, TMove> {
  const { board } = game.presentation;
  return {
    intentToMove: game.engine.intentToMove,
    targetsOfMove: (state, move) => board.targetsOfMove?.(state, move),
  };
}

/** The cells a drag from `from` to `to` fills at `state`, or its two ends when the game cannot say. */
function dragCells<TState, TMove>(
  game: CoachGame<TState, TMove>,
  state: TState,
  drag: { readonly from: BoardTarget; readonly to: BoardTarget },
): readonly BoardTarget[] {
  const move = game.intentToMove(state, { kind: 'drag-end', from: drag.from, to: drag.to });
  const cells = move === null ? undefined : game.targetsOfMove?.(state, move);
  return cells ?? [drag.from, drag.to];
}

/** The pointer at `state` as the board shows it (null: the coach has no pointer now). */
export function coachPointerOf<TState, TMove>(
  game: CoachGame<TState, TMove>,
  state: TState,
  pointer: TutorialPointer | null,
): CoachPointer {
  switch (pointer?.kind) {
    case 'drag':
      return {
        cells: dragCells(game, state, pointer),
        hand: { from: pointer.from, to: pointer.to },
      };
    case 'target':
      return { cells: [pointer.target], hand: { from: null, to: pointer.target } };
    case 'hud':
    case 'none':
    case undefined:
      return NO_COACH;
  }
}

/** What a board host gets from its screen (BoardHostProps' coach members). */
export type BoardCoachProps = {
  readonly coachTargets?: readonly BoardTarget[];
  readonly coachPointer?: TutorialPointer | null;
};

/**
 * A board host's coach: its pointer resolved through the game (null while the coach shows none),
 * or, from a screen that names only cells, those cells outlined without a hand.
 */
export function boardCoachOf<TState, TMove>(
  game: CoachGame<TState, TMove>,
  state: TState,
  props: BoardCoachProps,
): CoachPointer {
  if (props.coachPointer !== undefined) return coachPointerOf(game, state, props.coachPointer);
  const cells = props.coachTargets ?? [];
  return cells.length === 0 ? NO_COACH : { cells, hand: null };
}
