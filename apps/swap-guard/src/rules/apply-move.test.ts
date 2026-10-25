// apps/swap-guard/src/rules/apply-move.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

import type {
  Enemy,
  EnemyKind,
  Facing,
  SwapGuardEvent,
  SwapGuardState,
} from './swap-guard-types.ts';

type Piece = readonly [kind: EnemyKind, facing: Facing, cell: number];

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 30 });

/** A 5 x 5 board (squares 0..24, row-major) with the guard and these enemies (ids in order). */
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

/**
 * The opening of spec 13's pitch: the guard (12) stands in the strike of the spear on 11, and the
 * spear on 6 strikes the spear on 11. A third spear on 9 faces the edge.
 */
const OPENING = board(12, [
  ['spear', 'right', 11],
  ['spear', 'down', 6],
  ['spear', 'right', 9],
]);

/** Every listed move of a state is accepted, and the state itself stays as it was. */
function acceptsEveryListedMove(state: SwapGuardState): boolean {
  const frozen = JSON.stringify(state);
  const kinds = listMoves(state).flatMap((move) =>
    applyMove(state, move).events.map((e) => e.kind),
  );
  return kinds.every((kind) => /^[a-z]+(-[a-z]+)+$/.test(kind)) && JSON.stringify(state) === frozen;
}

/** Every piece on its own square, the swaps counted and the state JSON-safe. */
function isSound(state: SwapGuardState, swaps: number): boolean {
  const squares = [state.guard, ...state.enemies.map((e) => e.cell)];
  const roundTrip = JSON.stringify(JSON.parse(JSON.stringify(state)));
  return (
    new Set(squares).size === squares.length &&
    state.swaps === swaps &&
    roundTrip === JSON.stringify(state)
  );
}

/** True when the guard may swap with `cell`. */
function isListed(state: SwapGuardState, cell: number): boolean {
  return listMoves(state).some((move) => move.cell === cell);
}

/** A thunk that swaps the guard to `cell`, for toThrow. */
function swapTo(state: SwapGuardState, cell: number): () => unknown {
  return () => applyMove(state, { kind: 'swap', cell });
}

describe('applyMove (spec 13: swap places, then the strikes land, so enemies hit each other)', () => {
  it('swaps the guard with the enemy and lands every strike shown before the swap', () => {
    const { state, events } = applyMove(OPENING, { kind: 'swap', cell: 6 });
    expect(state.guard).toBe(6);
    expect(state.enemies).toStrictEqual([{ id: 2, kind: 'spear', facing: 'right', cell: 9 }]);
    expect(events).toStrictEqual(GOLDEN_DOUBLE_HIT_EVENTS);
  });

  it('scores the double hit: 100 per enemy and 50 for the second one', () => {
    expect(applyMove(OPENING, { kind: 'swap', cell: 6 }).state.score).toBe(250);
  });

  it('counts the swap and remembers what it did for the one continue', () => {
    const { state } = applyMove(OPENING, { kind: 'swap', cell: 6 });
    expect(state.swaps).toBe(1);
    expect(state.lastSwap).toStrictEqual({
      from: 12,
      to: 6,
      defeated: [
        { id: 0, kind: 'spear', facing: 'right', cell: 11 },
        { id: 1, kind: 'spear', facing: 'down', cell: 12 },
      ],
      points: 250,
    });
  });

  it('steps onto an empty square, and the strikes shown before the step still land', () => {
    const { state, events } = applyMove(OPENING, { kind: 'swap', cell: 13 });
    expect(state.guard).toBe(13);
    expect(state.isHit).toBe(false);
    expect(state.enemies.map((e) => e.id)).toStrictEqual([1, 2]);
    expect(events[0]).toStrictEqual({ kind: 'pieces-swapped', from: 12, to: 13, enemyId: null });
  });

  it('knocks out an enemy swapped into its own strike', () => {
    const behind = board(10, [['spear', 'right', 11]]);
    const faced = applyMove(behind, { kind: 'swap', cell: 11 }).state;
    expect(faced.enemies).toStrictEqual([{ id: 0, kind: 'spear', facing: 'right', cell: 10 }]);
    const { state, events } = applyMove(faced, { kind: 'swap', cell: 10 });
    expect(state.enemies).toStrictEqual([]);
    expect(events).toContainEqual({ kind: 'enemies-defeated', enemyIds: [0], cells: [11] });
  });

  it('hits the guard who ends a swap on a struck square', () => {
    const { state, events } = applyMove(OPENING, { kind: 'swap', cell: 11 });
    expect(state.isHit).toBe(true);
    expect(events).toContainEqual({ kind: 'guard-hit', cell: 11, enemyIds: [1] });
  });

  describe('when the move is illegal', () => {
    it('throws for a square that is not next to the guard', () => {
      expect(() => applyMove(OPENING, { kind: 'swap', cell: 24 })).toThrow(RangeError);
      expect(() => applyMove(OPENING, { kind: 'swap', cell: 12 })).toThrow(RangeError);
    });

    it('throws once the run is over', () => {
      const over = { ...OPENING, isHit: true };
      expect(() => applyMove(over, { kind: 'swap', cell: 6 })).toThrow(RangeError);
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

    it('accepts every listed move, never changes its input, and names events in kebab-case', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          expect(states.every(acceptsEveryListedMove)).toBe(true);
        }),
        { numRuns: 60 },
      );
    });

    it('throws a RangeError for any square it does not list', () => {
      fc.assert(
        fc.property(
          seedArb,
          difficultyArb,
          fc.integer({ min: -3, max: 40 }),
          (seed, difficulty, cell) => {
            const state = create(seed, difficulty);
            fc.pre(!isListed(state, cell));
            expect(swapTo(state, cell)).toThrow(RangeError);
          },
        ),
      );
    });

    it('keeps the pieces apart, counts each swap and keeps every state JSON-safe', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          expect(states.every(isSound)).toBe(true);
        }),
      );
    });
  });
});

const GOLDEN_DOUBLE_HIT_EVENTS: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 12, to: 6, enemyId: 1 },
  {
    kind: 'strikes-landed',
    strikes: [
      { enemyId: 0, cells: [12] },
      { enemyId: 1, cells: [11] },
    ],
  },
  { kind: 'enemies-defeated', enemyIds: [0, 1], cells: [11, 12] },
];
