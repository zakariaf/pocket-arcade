// apps/snare-snake/src/rules/apply-move.test.ts
// Spec 10 RULES: "Apply a move: returns the new state plus a list of events (what happened, for
// animations and sounds)". Spec 13: "crossing the snake's own body closes a loop, captures
// critters inside and spends those segments".
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { DIRECTIONS, neighboursOf } from './board-grid.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { TUNING, knobsFor } from './snare-snake-tuning.ts';

import type { Direction, SnareSnakeMove, SnareSnakeState } from './snare-snake-types.ts';

const at = (col: number, row: number): number => row * 7 + col;
const steer = (direction: Direction): SnareSnakeMove => ({ kind: 'steer', direction });

/** The seed 1 level (7 x 8) with the snake and the critters replaced. */
function placed(
  snake: readonly number[],
  critters: readonly number[],
  extra: Partial<SnareSnakeState> = {},
): SnareSnakeState {
  return { ...create(1, 0), snake, critters: critters.map((cell, id) => ({ id, cell })), ...extra };
}

/** The ring around (2, 2) walked from (1, 2) back to (1, 1), then a tail into the corner. */
const COILED = [
  at(1, 2),
  at(1, 3),
  at(2, 3),
  at(3, 3),
  at(3, 2),
  at(3, 1),
  at(2, 1),
  at(1, 1),
  at(0, 1),
  at(0, 0),
];

/** Every state of a seeded game played by the given choices (fast-check integers). */
function statesOf(seed: number, difficulty: number, choices: readonly number[]): SnareSnakeState[] {
  return [...playChoices({ listMoves, applyMove }, create(seed, difficulty), choices).states];
}

/** The directions listMoves offers. */
function listedDirections(state: SnareSnakeState): Direction[] {
  return listMoves(state).map((move) => move.direction);
}

/** Directions that do not throw, against the ones listMoves offers. */
function acceptedDirections(state: SnareSnakeState): Direction[] {
  return DIRECTIONS.filter((direction) => {
    try {
      applyMove(state, steer(direction));
      return true;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return false;
    }
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** The event kinds of every listed move of a frozen copy, and whether the copy stayed equal. */
function frozenRun(state: SnareSnakeState): { kinds: string[]; isUnchanged: boolean } {
  const frozen = deepFreeze(structuredClone(state));
  const kinds = listMoves(frozen).flatMap((move) =>
    applyMove(frozen, move).events.map((event) => event.kind),
  );
  return { kinds, isUnchanged: JSON.stringify(frozen) === JSON.stringify(state) };
}

/** The invariants of every reached state: one chain, critters on their own free cells, counts. */
function invariantsHold(state: SnareSnakeState): boolean {
  const { snake } = state;
  const isChain =
    new Set(snake).size === snake.length &&
    snake.slice(1).every((cell, index) => neighboursOf(state, cell).includes(snake[index] ?? -1));
  const cells = state.critters.map((critter) => critter.cell);
  const isFree =
    new Set(cells).size === cells.length && !cells.some((cell) => snake.includes(cell));
  return isChain && isFree && state.caught + state.critters.length === state.total;
}

/** The state as a save would bring it back (spec 8.6: runs are saved as JSON). */
function jsonRoundTrip(state: SnareSnakeState): unknown {
  return JSON.parse(JSON.stringify(state));
}

/** True when some line of at most `depth` moves catches a critter. */
function catchesWithin(state: SnareSnakeState, depth: number): boolean {
  if (depth <= 0) return false;
  return listMoves(state).some((move) => {
    const next = applyMove(state, move);
    const isCatch = next.events.some((event) => event.kind === 'critters-caught');
    return isCatch || catchesWithin(next.state, depth - 1);
  });
}

const PAST_TENSE_KINDS = [
  'snake-moved',
  'loop-closed',
  'critters-caught',
  'critters-moved',
  'bonus-added',
  'snake-stepped-back',
  'moves-added',
];

const playArb = fc.tuple(
  fc.nat(),
  fc.integer({ min: 0, max: 99 }),
  fc.array(fc.nat(), { maxLength: 40 }),
);

describe('applyMove (spec 10 RULES: apply a move, return the new state and its events)', () => {
  it('moves the head one cell and lets the tail follow', () => {
    const result = applyMove(placed([at(3, 4), at(2, 4), at(1, 4)], [at(6, 7)]), steer('right'));
    expect(result.state.snake).toStrictEqual([at(4, 4), at(3, 4), at(2, 4)]);
    expect(result.events[0]).toStrictEqual({
      kind: 'snake-moved',
      from: at(3, 4),
      to: at(4, 4),
      vacated: at(1, 4),
      length: 3,
    });
  });

  it('keeps the tail in place while the snake is growing', () => {
    const result = applyMove(placed([at(3, 4), at(2, 4)], [at(6, 7)], { growth: 2 }), steer('up'));
    expect(result.state.snake).toStrictEqual([at(3, 3), at(3, 4), at(2, 4)]);
    expect(result.state.growth).toBe(1);
    expect(result.events[0]).toMatchObject({ kind: 'snake-moved', vacated: null, length: 3 });
  });

  it('closes a loop on its own body and catches the critter inside it (spec 13)', () => {
    const result = applyMove(placed(COILED, [at(2, 2), at(6, 7)]), steer('up'));
    expect(result.events.slice(0, 2)).toStrictEqual([
      { kind: 'loop-closed', loop: COILED.slice(0, 8), enclosed: [at(2, 2)], spent: 7, length: 3 },
      {
        kind: 'critters-caught',
        critterIds: [0],
        cells: [at(2, 2)],
        count: 1,
        points: TUNING.catchPoints,
      },
    ]);
    expect(result.state.snake).toStrictEqual([at(1, 1), at(0, 1), at(0, 0)]);
    expect(result.state.critters.map((critter) => critter.id)).toStrictEqual([1]);
    expect(result.state.caught).toBe(1);
  });

  it('catches the critters touching the loop too (the design fix), and scores 10 x n x n', () => {
    const result = applyMove(placed(COILED, [at(2, 2), at(4, 2), at(6, 7)]), steer('up'));
    expect(result.events[1]).toMatchObject({
      kind: 'critters-caught',
      critterIds: [0, 1],
      count: 2,
      points: 40,
    });
    expect(result.state.score).toBe(40);
    expect(result.state.growth).toBe(2 * TUNING.growPerCritter);
  });

  it('spends the segments of a loop that catches nothing', () => {
    const curl = [at(4, 4), at(5, 4), at(5, 5), at(4, 5), at(3, 5)];
    const result = applyMove(placed(curl, [at(0, 0)]), steer('down'));
    expect(result.events).toStrictEqual([
      { kind: 'loop-closed', loop: curl.slice(0, 4), enclosed: [], spent: 3, length: 2 },
    ]);
    expect(result.state.snake).toStrictEqual([at(4, 5), at(3, 5)]);
  });

  it('adds the bonus for the moves left when the last critter is caught', () => {
    const result = applyMove(placed(COILED, [at(2, 2)], { moves: 10 }), steer('up'));
    const bonus = (30 - 11) * TUNING.pointsPerSpareMove;
    expect(result.events.at(-1)).toStrictEqual({
      kind: 'bonus-added',
      points: bonus,
      total: TUNING.catchPoints + bonus,
    });
    expect(result.state.score).toBe(TUNING.catchPoints + bonus);
  });

  it('counts the move and grows one segment every growEvery moves', () => {
    const growEvery = knobsFor(0).growEvery;
    const state = placed([at(3, 4), at(2, 4)], [at(6, 7)], { moves: growEvery - 1 });
    const next = applyMove(state, steer('up')).state;
    expect([next.moves, next.growth]).toStrictEqual([growEvery, 1]);
  });

  it('lets the critters hop after the snake on a hop turn', () => {
    const state = placed([at(0, 0), at(1, 0)], [at(4, 5)], { moves: knobsFor(0).hopEvery - 1 });
    const result = applyMove(state, steer('down'));
    expect(result.events.map((event) => event.kind)).toStrictEqual([
      'snake-moved',
      'critters-moved',
    ]);
  });

  it('throws a RangeError for a move that is not allowed', () => {
    const state = placed([at(3, 4), at(2, 4)], [at(4, 4)]);
    expect(() => applyMove(state, steer('left'))).toThrow(RangeError);
    expect(() => applyMove(state, steer('right'))).toThrow(RangeError);
    expect(() => applyMove(state, steer('sideways' as Direction))).toThrow(RangeError);
    expect(() => applyMove({ ...state, moves: 30 }, steer('up'))).toThrow(RangeError);
  });

  it('keeps the pinned events of the seed 1 opening line', () => {
    let state = create(1, 0);
    const kinds: string[] = [];
    for (const direction of GOLDEN_SEED_1_LINE) {
      const result = applyMove(state, steer(direction));
      kinds.push(...result.events.map((event) => event.kind));
      state = result.state;
    }
    expect(kinds).toStrictEqual(GOLDEN_SEED_1_KINDS);
  });

  it('accepts every listed move and refuses every other direction with a RangeError (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const states = statesOf(seed, difficulty, choices);
        expect(states.map(acceptedDirections)).toStrictEqual(states.map(listedDirections));
      }),
    );
  });

  it('keeps its input unchanged and names its events in past-tense kebab-case (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const runs = statesOf(seed, difficulty, choices).map(frozenRun);
        expect(runs.every((run) => run.isUnchanged)).toBe(true);
        const kinds = new Set(runs.flatMap((run) => run.kinds));
        expect([...kinds].filter((kind) => !PAST_TENSE_KINDS.includes(kind))).toStrictEqual([]);
      }),
    );
  });

  it('keeps every played state JSON-safe: a JSON round trip gives the same state (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const states = statesOf(seed, difficulty, choices);
        expect(states.map(jsonRoundTrip)).toStrictEqual(states);
      }),
    );
  });

  it('keeps the snake one chain and every critter on its own free cell (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        expect(statesOf(seed, difficulty, choices).every(invariantsHold)).toBe(true);
      }),
    );
  });

  it('lets the snake catch a nest critter within nestGap + 1 moves (property: the design fix)', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        expect(catchesWithin(create(seed, difficulty), TUNING.nestGap + 1)).toBe(true);
      }),
    );
  });
});

const GOLDEN_SEED_1_LINE: readonly Direction[] = ['down', 'left', 'left'];
const GOLDEN_SEED_1_KINDS: readonly string[] = [
  'snake-moved',
  'snake-moved',
  'loop-closed',
  'critters-caught',
];
