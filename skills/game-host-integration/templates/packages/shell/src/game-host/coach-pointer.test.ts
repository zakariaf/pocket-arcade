// packages/shell/src/game-host/coach-pointer.test.ts
import { boardCoachOf, coachGameOf, coachPointerOf, NO_COACH } from './coach-pointer.ts';

import type { CoachGame } from './coach-pointer.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { TutorialPointer } from '@e07/game-kit/contract/teaching.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** A column of 3 cells (0 empty, 1 filled) and one tray slot holding a vertical two. */
type Column = readonly (0 | 1)[];
type Place = { readonly row: number };

const SLOT: BoardTarget = { regionId: 'tray', col: 0, row: 0 };
const cell = (row: number): BoardTarget => ({ regionId: 'board', col: 0, row });

/** The vertical two's slot and both cells it fills. */
function columnCells(_column: Column, move: Place): readonly BoardTarget[] {
  return [SLOT, cell(move.row), cell(move.row + 1)];
}

/** Drops the vertical two with its top cell on the released row, when both cells are empty. */
const COLUMN_GAME: CoachGame<Column, Place> = {
  intentToMove: (column: Column, intent: InputIntent) => {
    if (intent.kind !== 'drag-end' || intent.to?.regionId !== 'board') return null;
    const { row } = intent.to;
    return column[row] === 0 && column[row + 1] === 0 ? { row } : null;
  },
  targetsOfMove: columnCells,
};
const GAP_AT_1: Column = [1, 0, 0];

describe('coachPointerOf', () => {
  it('outlines every cell the dragged block fills, not only the two ends of the drag', () => {
    // Spec S13: one pointer per step. A drag pointer names the slot and the cell it drops on, but
    // the block covers more: Line Siege's vertical two left its second gap cell unmarked (2026-10-18).
    const pointer = { kind: 'drag', from: SLOT, to: cell(1) } as const;
    expect(coachPointerOf(COLUMN_GAME, GAP_AT_1, pointer)).toStrictEqual({
      cells: [SLOT, cell(1), cell(2)],
      hand: { from: SLOT, to: cell(1) },
    });
  });

  it('keeps the two ends when the drag is no move or the board cannot name its cells', () => {
    const pointer = { kind: 'drag', from: SLOT, to: cell(0) } as const;
    expect(coachPointerOf(COLUMN_GAME, GAP_AT_1, pointer)).toStrictEqual({
      cells: [SLOT, cell(0)],
      hand: { from: SLOT, to: cell(0) },
    });
    const bare = { intentToMove: COLUMN_GAME.intentToMove };
    const fits = { kind: 'drag', from: SLOT, to: cell(1) } as const;
    expect(coachPointerOf(bare, GAP_AT_1, fits).cells).toStrictEqual([SLOT, cell(1)]);
  });

  it('points the hand at a target pointer, and shows nothing for the top bar or no pointer', () => {
    const target = { kind: 'target', target: cell(2) } as const;
    expect(coachPointerOf(COLUMN_GAME, GAP_AT_1, target)).toStrictEqual({
      cells: [cell(2)],
      hand: { from: null, to: cell(2) },
    });
    const hud = { kind: 'hud', element: 'undo' } as const;
    expect(coachPointerOf(COLUMN_GAME, GAP_AT_1, hud)).toBe(NO_COACH);
    expect(coachPointerOf(COLUMN_GAME, GAP_AT_1, { kind: 'none' })).toBe(NO_COACH);
    expect(coachPointerOf(COLUMN_GAME, GAP_AT_1, null)).toBe(NO_COACH);
  });
});

describe('boardCoachOf', () => {
  /** What a board host shows for its screen's pointer (the Game screen leaves it out). */
  function hostCoach(coachPointer?: TutorialPointer | null) {
    return boardCoachOf(COLUMN_GAME, GAP_AT_1, coachPointer);
  }

  it("resolves a board host's pointer, and shows none when its screen names none", () => {
    const pointer = { kind: 'drag', from: SLOT, to: cell(1) } as const;
    expect(hostCoach(pointer).cells).toStrictEqual([SLOT, cell(1), cell(2)]);
    expect(hostCoach({ kind: 'target', target: cell(0) })).toStrictEqual({
      cells: [cell(0)],
      hand: { from: null, to: cell(0) },
    });
    expect(hostCoach()).toBe(NO_COACH);
    expect(hostCoach(null)).toBe(NO_COACH);
  });
});

describe('coachGameOf', () => {
  it("reads the module's intent rule and its board's cells, and keeps the ends without them", () => {
    const pointer = { kind: 'drag', from: SLOT, to: cell(1) } as const;
    const module = {
      engine: { intentToMove: COLUMN_GAME.intentToMove },
      presentation: { board: { targetsOfMove: columnCells } },
    };
    expect(coachPointerOf(coachGameOf(module), GAP_AT_1, pointer).cells).toHaveLength(3);
    const bare = { engine: module.engine, presentation: { board: {} } };
    expect(coachPointerOf(coachGameOf(bare), GAP_AT_1, pointer).cells).toStrictEqual([
      SLOT,
      cell(1),
    ]);
  });
});
