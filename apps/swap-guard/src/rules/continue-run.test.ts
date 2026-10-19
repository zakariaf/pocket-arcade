// apps/swap-guard/src/rules/continue-run.test.ts
// Spec 8.10: "Games may allow one continue per level or run: for example ... the last move is
// undone." Swap Guard's one continue undoes the last swap, from every way of losing.
import fc from 'fast-check';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { Enemy, EnemyKind, Facing, SwapGuardState } from './swap-guard-types.ts';

type Piece = readonly [kind: EnemyKind, facing: Facing, cell: number];

function board(guard: number, pieces: readonly Piece[]): SwapGuardState {
  const enemies: Enemy[] = pieces.map(([kind, facing, cell], id) => ({ id, kind, facing, cell }));
  return {
    size: 5,
    guard,
    enemies,
    enemyCount: enemies.length,
    swaps: 0,
    maxSwaps: 12,
    score: 0,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
  };
}

/** The guard on 12 in the spear on 11's strike; the spear on 6 strikes the spear on 11. */
const OPENING = board(12, [
  ['spear', 'right', 11],
  ['spear', 'down', 6],
  ['spear', 'right', 9],
]);

/** The spear on 8 strikes 13: a step from 12 to 13 is hit and knocks nobody out. */
const STEP_INTO_STRIKE = board(12, [
  ['spear', 'down', 8],
  ['spear', 'down', 24],
]);

/** Far more swaps than any budget: a run still playing after them would be a rules bug. */
const MAX_SWAPS = 100;

/** Seeded random swaps until the run ends (the swap budget always ends it). */
function playToEnd(seed: number, difficulty: number): SwapGuardState {
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  for (let swaps = 0; swaps < MAX_SWAPS && outcome(state).kind === 'playing'; swaps += 1) {
    const moves = listMoves(state);
    const pick = nextInt(rng, moves.length);
    rng = pick.state;
    state = applyMove(state, pickAt(moves, pick.value)).state;
  }
  return state;
}

describe('continueAfterLoss', () => {
  describe('after a strike hit the guard', () => {
    const lost = applyMove(STEP_INTO_STRIKE, { kind: 'swap', cell: 13 }).state;

    it('undoes the last swap: the same squares, the swap given back', () => {
      const { state } = continueAfterLoss(lost);
      expect(state).toStrictEqual({ ...STEP_INTO_STRIKE, hasContinued: true });
      expect(outcome(state).kind).toBe('playing');
    });

    it('says so in one event', () => {
      expect(continueAfterLoss(lost).events).toStrictEqual([
        { kind: 'swap-reversed', from: 13, to: 12, enemyId: null, restoredIds: [] },
      ]);
    });
  });

  describe('after a hit that also knocked out enemies', () => {
    it('stands them again where they stood and swaps the enemy back', () => {
      const lost = applyMove(OPENING, { kind: 'swap', cell: 11 }).state;
      expect(lost.enemies.map((e) => e.id)).toStrictEqual([1, 2]);
      const { state, events } = continueAfterLoss(lost);
      expect(state).toStrictEqual({ ...OPENING, hasContinued: true });
      expect(events).toStrictEqual([
        { kind: 'swap-reversed', from: 11, to: 12, enemyId: 0, restoredIds: [0] },
      ]);
    });
  });

  describe('after the swaps ran out', () => {
    it('gives the last swap back', () => {
      const tired = { ...OPENING, swaps: 11 };
      const lost = applyMove(tired, { kind: 'swap', cell: 17 }).state;
      expect(outcome(lost)).toStrictEqual({
        kind: 'lost',
        reasonKey: 'swap-guard.lose.out-of-swaps',
      });
      expect(continueAfterLoss(lost).state).toStrictEqual({ ...tired, hasContinued: true });
    });
  });

  describe('when no continue is due', () => {
    it('refuses a second continue in the same run', () => {
      const lost = applyMove(OPENING, { kind: 'swap', cell: 11 }).state;
      expect(() => continueAfterLoss({ ...lost, hasContinued: true })).toThrow(RangeError);
    });

    it('refuses a run that is not lost', () => {
      expect(() => continueAfterLoss(OPENING)).toThrow(RangeError);
    });

    it('refuses a lost run with no swap to undo', () => {
      expect(() => continueAfterLoss({ ...OPENING, isHit: true })).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('makes every lost run playable again from the state before its last swap', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.integer({ min: 0, max: 99 }),
          (seed, difficulty) => {
            const lost = playToEnd(seed, difficulty);
            expect(outcome(lost).kind).not.toBe('playing');
            fc.pre(outcome(lost).kind === 'lost');
            const { state } = continueAfterLoss(lost);
            expect(outcome(state).kind).toBe('playing');
            expect(state.swaps).toBe(lost.swaps - 1);
            expect(state.hasContinued).toBe(true);
          },
        ),
      );
    });
  });
});
