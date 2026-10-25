// apps/jump-chain/src/rules/apply-move.test.ts
// Spec 10, RULES: "Apply a move: returns the new state plus a list of events (what happened, for
// animations and sounds)". Jump Chain: a chain removes every jumped enemy in order, then the enemy
// ranks advance when the march clock runs out.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove, isSameMove } from './apply-move.ts';
import { create } from './create.ts';
import { TUNING, chainPoints, knobsFor } from './jump-chain-tuning.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { JumpChainEvent, JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });

type EnemySpec = readonly [col: number, row: number, rank?: number];

/** A level-0 state with your piece and the enemies on the given squares (ids in that order). */
function position(
  piece: Square,
  enemySquares: readonly EnemySpec[],
  overrides: Partial<JumpChainState> = {},
): JumpChainState {
  const enemies = enemySquares.map(([col, row, rank = 0], id) => ({ id, rank, col, row }));
  return {
    ...create(1, 0),
    piece,
    enemies,
    total: enemies.length,
    nextId: enemies.length,
    ...overrides,
  };
}

function jump(...squares: readonly (readonly [number, number])[]): JumpChainMove {
  return { kind: 'jump', path: squares.map(([col, row]) => ({ col, row })) };
}

function step(col: number, row: number): JumpChainMove {
  return { kind: 'step', to: { col, row } };
}

function kinds(events: readonly JumpChainEvent[]): string[] {
  return events.map((event) => event.kind);
}

describe('applyMove', () => {
  describe('a jump chain', () => {
    it('removes every jumped enemy in order and scores the chain (10 + 20)', () => {
      const state = position(
        { col: 2, row: 6 },
        [
          [3, 5],
          [5, 3],
          [1, 5],
        ],
        { marchIn: 3 },
      );
      const { state: next, events } = applyMove(state, jump([4, 4], [6, 2]));
      expect(next.piece).toStrictEqual({ col: 6, row: 2 });
      expect(next.enemies.map((enemy) => enemy.id)).toStrictEqual([2]);
      expect(next).toMatchObject({ captured: 2, score: 30, moves: 1, marchIn: 2 });
      expect(events).toStrictEqual([
        {
          kind: 'piece-jumped',
          from: { col: 2, row: 6 },
          to: { col: 4, row: 4 },
          enemyId: 0,
          jump: 1,
        },
        {
          kind: 'piece-jumped',
          from: { col: 4, row: 4 },
          to: { col: 6, row: 2 },
          enemyId: 1,
          jump: 2,
        },
        { kind: 'enemies-captured', enemyIds: [0, 1], chain: 2, points: chainPoints(2) },
      ]);
    });

    it('clears a rank when its last enemy is captured, for rankPoints more', () => {
      const state = position(
        { col: 2, row: 6 },
        [
          [3, 5, 0],
          [5, 3, 1],
          [1, 3, 1],
        ],
        { marchIn: 3 },
      );
      const { state: next, events } = applyMove(state, jump([4, 4]));
      expect(events.at(-1)).toStrictEqual({
        kind: 'rank-cleared',
        rank: 0,
        points: TUNING.rankPoints,
      });
      expect(next).toMatchObject({ ranksCleared: 1, score: chainPoints(1) + TUNING.rankPoints });
    });

    it('wins at once when the last enemy goes: no march after the winning move', () => {
      const state = position({ col: 2, row: 6 }, [[3, 5]], { marchIn: 1 });
      const { state: next, events } = applyMove(state, jump([4, 4]));
      expect(outcome(next)).toStrictEqual({ kind: 'won', score: next.score });
      expect(kinds(events)).toStrictEqual(['piece-jumped', 'enemies-captured', 'rank-cleared']);
    });
  });

  describe('a step', () => {
    it('moves the piece one square and counts the move', () => {
      const state = position({ col: 3, row: 7 }, [[3, 3]], { marchIn: 3 });
      const { state: next, events } = applyMove(state, step(2, 6));
      expect(next).toMatchObject({ piece: { col: 2, row: 6 }, moves: 1, marchIn: 2 });
      expect(events).toStrictEqual([
        { kind: 'piece-stepped', from: { col: 3, row: 7 }, to: { col: 2, row: 6 } },
      ]);
    });
  });

  describe('when the march clock runs out', () => {
    it('advances every enemy two rows, front first, and restarts the clock', () => {
      const state = position(
        { col: 6, row: 8 },
        [
          [3, 5],
          [3, 3],
          [1, 1, 1],
        ],
        { marchIn: 1 },
      );
      const { state: next, events } = applyMove(state, step(5, 7));
      expect(next.enemies.map((enemy) => enemy.row)).toStrictEqual([7, 5, 3]);
      expect(next.marchIn).toBe(knobsFor(0).marchEvery);
      expect(events.at(-1)).toStrictEqual({
        kind: 'ranks-advanced',
        shifts: [
          { enemyId: 0, col: 3, fromRow: 5, toRow: 7 },
          { enemyId: 1, col: 3, fromRow: 3, toRow: 5 },
          { enemyId: 2, col: 1, fromRow: 1, toRow: 3 },
        ],
      });
    });

    it('holds an enemy whose square is your piece, and the enemies queued behind it', () => {
      const state = position(
        { col: 2, row: 8 },
        [
          [3, 5],
          [3, 3],
          [5, 5],
        ],
        { marchIn: 1 },
      );
      const { state: next } = applyMove(state, step(3, 7));
      expect(next.enemies.map((enemy) => enemy.row)).toStrictEqual([5, 3, 7]);
    });

    it('loses when an enemy reaches your side (row 9)', () => {
      const state = position({ col: 2, row: 2 }, [[5, 7]], { marchIn: 1 });
      const { state: next, events } = applyMove(state, step(1, 1));
      expect(outcome(next)).toStrictEqual({ kind: 'lost', reasonKey: 'jump-chain.lose.overrun' });
      expect(events.at(-1)).toStrictEqual({ kind: 'side-reached', enemyIds: [0] });
    });
  });

  describe('when no enemy is left on the board', () => {
    it('brings the next waiting rank in at once', () => {
      const state = position(
        { col: 2, row: 6 },
        [
          [3, 5],
          [3, -1, 1],
        ],
        { marchIn: 3 },
      );
      const { state: next, events } = applyMove(state, jump([4, 4]));
      expect(next.enemies.map((enemy) => enemy.row)).toStrictEqual([1]);
      expect(kinds(events).at(-1)).toBe('ranks-advanced');
      expect(next.marchIn).toBe(knobsFor(0).marchEvery);
    });
  });

  describe('in the endless run (difficulty 100)', () => {
    it('makes a new rank above the board whenever none waits there', () => {
      const start = create(5, ENDLESS_DIFFICULTY);
      const state = { ...start, marchIn: 1 };
      const move = listMoves(state)[0];
      if (move === undefined) throw new Error('no move at the start');
      const { state: next, events } = applyMove(state, move);
      const spawned = events.find((event) => event.kind === 'rank-spawned');
      expect(spawned).toMatchObject({ kind: 'rank-spawned', rank: start.nextRank });
      expect(next.enemies.some((enemy) => enemy.row === -1)).toBe(true);
      expect(next.nextRank).toBe(start.nextRank + 1);
      expect(next.total).toBeGreaterThan(start.total);
    });
  });

  describe('when the move is illegal', () => {
    it('throws for a step while a jump is possible (a capture must be taken)', () => {
      const state = position({ col: 2, row: 6 }, [[3, 5]]);
      expect(() => applyMove(state, step(1, 7))).toThrow(RangeError);
    });

    it('throws for a jump over nothing and once the run is over', () => {
      const state = position({ col: 2, row: 6 }, [[3, 3]]);
      const lost = position({ col: 2, row: 6 }, [[3, 9]]);
      expect(() => applyMove(state, jump([4, 4]))).toThrow(RangeError);
      expect(() => applyMove(lost, step(1, 5))).toThrow(RangeError);
    });
  });

  describe('isSameMove', () => {
    it('compares the kind and every square in order', () => {
      expect(isSameMove(jump([4, 4], [6, 2]), jump([4, 4], [6, 2]))).toBe(true);
      expect(isSameMove(jump([4, 4], [6, 2]), jump([4, 4]))).toBe(false);
      expect(isSameMove(step(4, 4), jump([4, 4]))).toBe(false);
      expect(isSameMove(step(4, 4), step(2, 4))).toBe(false);
    });
  });

  describe('properties', () => {
    it('replays identically for the same seed, difficulty and move choices', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const first = playChoices(RULES, create(seed, difficulty), choices);
          expect(playChoices(RULES, create(seed, difficulty), choices)).toStrictEqual(first);
        }),
      );
    });

    it('accepts every listed move and never changes its input', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          for (const state of states) expectEveryListedMoveApplies(state);
        }),
        { numRuns: 60 },
      );
    });

    it('keeps the counts, the ids and the dark squares straight', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          for (const state of states) expectInvariants(state);
        }),
        { numRuns: 200 },
      );
    });

    it('names every event in past-tense kebab-case and survives a JSON round trip', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states, events } = playChoices(RULES, create(seed, difficulty), choices);
          expect(isEveryKindKebab(events)).toBe(true);
          const last = states[states.length - 1];
          expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
        }),
      );
    });

    it('keeps every endless run unwon', () => {
      fc.assert(
        fc.property(seedArb, fc.array(fc.nat(), { maxLength: 80 }), (seed, choices) => {
          const { states } = playChoices(RULES, create(seed, ENDLESS_DIFFICULTY), choices);
          expect(hasWin(states)).toBe(false);
        }),
      );
    });
  });
});

/** Event kinds are kebab-case words (past tense is checked by check-rules-engine). */
function isEveryKindKebab(events: readonly JumpChainEvent[]): boolean {
  return events.every((event) => /^[a-z]+(-[a-z]+)*$/.test(event.kind));
}

function hasWin(states: readonly JumpChainState[]): boolean {
  return states.some((state) => outcome(state).kind === 'won');
}

/** Every move listMoves offers applies, and applying it leaves the state untouched. */
function expectEveryListedMoveApplies(state: JumpChainState): void {
  const before = JSON.stringify(state);
  for (const move of listMoves(state)) expect(() => applyMove(state, move)).not.toThrow();
  expect(JSON.stringify(state)).toBe(before);
}

/** Captured + left = total, ids unique, every enemy on a dark square of the ranks' rows. */
function expectInvariants(state: JumpChainState): void {
  expect(state.captured + state.enemies.length).toBe(state.total);
  expect(new Set(state.enemies.map((enemy) => enemy.id)).size).toBe(state.enemies.length);
  expect(state.enemies.every((enemy) => Math.abs(enemy.row % 2) === 1)).toBe(true);
  expect(state.enemies.every((enemy) => enemy.col % 2 === 1)).toBe(true);
  expect((state.piece.col + state.piece.row) % 2).toBe(0);
}
