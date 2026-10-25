// apps/stepstone/src/rules/intent-to-move.test.ts
// Spec S5: Stepstone is played with one tap on a stone the frog's hop reaches; nothing else moves.
import fc from 'fast-check';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';
import { pondFromText } from './pond-text.ts';

import type { StepstoneState } from './stepstone-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Seed 1 at difficulty 0: the golden pond, the rook at 2 reaching the king at 12 and the rook at 17. */
const STATE = create(1, 0);
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });

function pond(rows: readonly string[]): StepstoneState {
  return { ...pondFromText(rows.join('\n')), moves: 3, par: 3, kindsUsed: ['rook'] };
}

describe('intentToMove', () => {
  it('hops onto the tapped stone the frog reaches', () => {
    expect(intentToMove(STATE, tap(cell(2, 2)))).toStrictEqual({ kind: 'hop', to: 12 });
    expect(intentToMove(STATE, tap(cell(2, 3)))).toStrictEqual({ kind: 'hop', to: 17 });
  });

  it('refuses water, a stone out of reach, the frog itself, a cell off the pond and other regions', () => {
    const refused = [
      cell(0, 0),
      cell(3, 3),
      cell(2, 0),
      cell(5, 0),
      cell(-1, 2),
      cell(2, 5),
      { regionId: 'tray', col: 2, row: 2 },
    ];
    expect(refused.map((target) => intentToMove(STATE, tap(target)))).toStrictEqual(
      refused.map(() => null),
    );
  });

  it('gives no move once the frog is on the flag (listMoves is empty)', () => {
    const won = applyMove(pond(['r...F', '.....', '.....', '.....', 'K....']), {
      kind: 'hop',
      to: 4,
    }).state;
    expect(listMoves(won)).toStrictEqual([]);
    expect(intentToMove(won, tap(cell(0, 4)))).toBeNull();
  });

  it('gives no move once the frog is stranded', () => {
    const stranded = pond(['k~...', '~~...', '....F', '.....', 'R....']);
    expect(intentToMove(stranded, tap(cell(0, 4)))).toBeNull();
  });

  it('ignores intents this game does not use', () => {
    const unused: InputIntent[] = [
      { kind: 'swipe', direction: 'up', from: null },
      { kind: 'long-press', target: cell(2, 2) },
      { kind: 'drag-end', from: cell(2, 0), to: cell(2, 2) },
      { kind: 'aim', dx: 10, dy: -40 },
    ];
    expect(unused.map((intent) => intentToMove(STATE, intent))).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('returns only moves that listMoves lists, and every listed hop is one tap away', () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.nat({ max: 9_999 }),
          difficulty: fc.integer({ min: 0, max: 100 }),
          col: fc.integer({ min: -1, max: 8 }),
          row: fc.integer({ min: -1, max: 8 }),
        }),
        ({ seed, difficulty, col, row }) => {
          const state = create(seed, difficulty);
          const move = intentToMove(state, tap(cell(col, row)));
          const listed = listMoves(state);
          expect(move === null || listed.some((legal) => legal.to === move.to)).toBe(true);
          for (const legal of listed) {
            const target = cell(legal.to % state.side, Math.floor(legal.to / state.side));
            expect(intentToMove(state, tap(target))).toStrictEqual(legal);
          }
        },
      ),
      { seed: 3, numRuns: 200 },
    );
  });
});
