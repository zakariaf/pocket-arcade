// apps/jump-chain/src/rules/intent-to-move.test.ts
// The piece is dragged from its square to the square where the move should end, or that square is
// tapped. Either way the move that ends there is played (move-ends.ts): the longest chain, the first
// listed among equally long ones, or the step onto it. A drag let go back on the piece's own square
// cancels (there is no undo, so that is how a player takes a drag back).
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { intentToMove } from './intent-to-move.ts';
import { listMoves } from './list-moves.ts';

import type { JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const cell = (square: Square): BoardTarget => ({ regionId: 'board', ...square });
const tap = (square: Square): InputIntent => ({
  kind: 'tap',
  target: cell(square),
  selected: null,
});

function position(
  piece: Square,
  enemySquares: readonly (readonly [number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row], id) => ({ id, rank: 0, col, row }));
  return { ...create(1, 0), piece, enemies, total: enemies.length, nextId: enemies.length };
}

/** Five enemies around (2, 6): a four-jump chain leads round the front two and back again. */
const CHAINS = position({ col: 2, row: 6 }, [
  [1, 5],
  [3, 5],
  [1, 3],
  [3, 3],
  [5, 3],
]);
const PIECE = CHAINS.piece;
const TO_TOP: JumpChainMove = {
  kind: 'jump',
  path: [
    { col: 0, row: 4 },
    { col: 2, row: 2 },
  ],
};

function drag(state: JumpChainState, to: Square | null): InputIntent {
  return { kind: 'drag-end', from: cell(state.piece), to: to === null ? null : cell(to) };
}

function endOf(move: JumpChainMove): Square | undefined {
  return move.kind === 'step' ? move.to : move.path.at(-1);
}

/**
 * A drag to any square (on the board or off it) plays a listed move or nothing; every end but the
 * piece's own square (where a drag cancels) works.
 */
function expectDrags(state: JumpChainState): void {
  const listed = listMoves(state).map((move) => JSON.stringify(move));
  for (let row = -1; row <= 10; row += 1) {
    for (let col = -1; col <= 7; col += 1) {
      const move = intentToMove(state, drag(state, { col, row }));
      expect(move === null || listed.includes(JSON.stringify(move))).toBe(true);
    }
  }
  for (const move of listMoves(state)) {
    const end = endOf(move);
    if (end === undefined) continue;
    const played = intentToMove(state, drag(state, end));
    if (end.col === state.piece.col && end.row === state.piece.row) expect(played).toBeNull();
    else expect(played).not.toBeNull();
  }
}

describe('intentToMove', () => {
  it('plays the chain that ends where the dragged piece is let go', () => {
    expect(intentToMove(CHAINS, drag(CHAINS, { col: 2, row: 2 }))).toStrictEqual(TO_TOP);
  });

  it('plays the same chain for a tap on the square where it ends', () => {
    const square = { col: 2, row: 2 };
    expect(intentToMove(CHAINS, tap(square))).toStrictEqual(
      intentToMove(CHAINS, drag(CHAINS, square)),
    );
  });

  it('cancels a drag let go back on the piece’s own square, even where a loop chain ends', () => {
    expect(intentToMove(CHAINS, drag(CHAINS, PIECE))).toBeNull();
  });

  it('plays a step onto a free neighbour when no jump exists, dragged or tapped', () => {
    const quiet = position({ col: 3, row: 7 }, [[3, 3]]);
    const step = { kind: 'step', to: { col: 2, row: 6 } };
    expect(intentToMove(quiet, drag(quiet, { col: 2, row: 6 }))).toStrictEqual(step);
    expect(intentToMove(quiet, tap({ col: 2, row: 6 }))).toStrictEqual(step);
  });

  it('refuses a square no move ends on, a drop off the board and a drag that starts off the piece', () => {
    const intents: InputIntent[] = [
      drag(CHAINS, { col: 3, row: 5 }),
      drag(CHAINS, { col: 6, row: 9 }),
      drag(CHAINS, null),
      { kind: 'drag-end', from: cell({ col: 4, row: 6 }), to: cell({ col: 2, row: 2 }) },
      { kind: 'drag-end', from: cell(PIECE), to: { regionId: 'tray', col: 2, row: 2 } },
      tap({ col: 3, row: 5 }),
      { kind: 'tap', target: { regionId: 'tray', col: 2, row: 2 }, selected: null },
    ];
    expect(intents.map((intent) => intentToMove(CHAINS, intent))).toStrictEqual(
      intents.map(() => null),
    );
  });

  it('ignores a tap on the piece itself, so touching it never plays a loop by accident', () => {
    expect(intentToMove(CHAINS, tap(PIECE))).toBeNull();
  });

  it('gives no move once the run is won or lost (listMoves is empty)', () => {
    const won = position({ col: 3, row: 7 }, []);
    const lost = position({ col: 3, row: 7 }, [[1, 9]]);
    expect([listMoves(won), listMoves(lost)]).toStrictEqual([[], []]);
    expect(intentToMove(won, tap({ col: 2, row: 6 }))).toBeNull();
    expect(intentToMove(lost, drag(lost, { col: 2, row: 6 }))).toBeNull();
  });

  it('ignores intents this game does not use', () => {
    const unused: InputIntent[] = [
      { kind: 'swipe', direction: 'up', from: null },
      { kind: 'long-press', target: cell({ col: 2, row: 2 }) },
      { kind: 'aim', dx: 10, dy: -40 },
    ];
    expect(unused.map((intent) => intentToMove(CHAINS, intent))).toStrictEqual([null, null, null]);
  });

  it('returns only moves that listMoves lists, and reaches every end square', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 12 }),
        (seed, difficulty, choices) => {
          const { states } = playChoices(
            { listMoves, applyMove },
            create(seed, difficulty),
            choices,
          );
          for (const state of states) expectDrags(state);
        },
      ),
      { seed: 5, numRuns: 60 },
    );
  });
});
