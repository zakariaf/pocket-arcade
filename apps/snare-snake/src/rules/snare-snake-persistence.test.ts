// apps/snare-snake/src/rules/snare-snake-persistence.test.ts
// Spec 8.6 and N10: a run survives every kill and every app update; a saved run that no longer
// parses is dropped alone (spec 8.14), never a crash.
import fc from 'fast-check';

import { hashSeed } from '@e07/game-kit/rng/sfc32.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';
import v1Runs from '@e07/snare-snake/rules/fixtures/save-v1-run-states.json';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import {
  SNARE_SNAKE_PERSISTENCE,
  migrateState,
  parseMove,
  parseState,
} from './snare-snake-persistence.ts';

import type { SnareSnakeMove, SnareSnakeState } from './snare-snake-types.ts';

const playArb = fc.tuple(
  fc.nat(),
  fc.integer({ min: 0, max: 99 }),
  fc.array(fc.nat(), { maxLength: 40 }),
);

const fromJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

function played(seed: number, difficulty: number, choices: readonly number[]) {
  return playChoices({ listMoves, applyMove }, create(seed, difficulty), choices);
}

/** The move line a player makes with these choices (playChoices' choice rule), and its end. */
function playedLine(
  seed: number,
  difficulty: number,
  choices: readonly number[],
): { readonly moves: SnareSnakeMove[]; readonly end: SnareSnakeState } {
  const moves: SnareSnakeMove[] = [];
  let end = create(seed, difficulty);
  for (const choice of choices) {
    const listed = listMoves(end);
    const move = listed[choice % Math.max(listed.length, 1)];
    if (move === undefined) break;
    moves.push(move);
    end = applyMove(end, move).state;
  }
  return { moves, end };
}

/** The run rebuilt from its start and its saved move line, each move parsed back first. */
function replay(start: SnareSnakeState, moves: readonly SnareSnakeMove[]): SnareSnakeState {
  return moves.reduce((state, move) => {
    const parsed = parseMove(fromJson(move));
    if (parsed === null) throw new Error(`a saved move did not parse: ${JSON.stringify(move)}`);
    return applyMove(state, parsed).state;
  }, start);
}

const START = create(1, 0);

describe('parseState (spec 8.6: a saved run comes back exactly)', () => {
  it('returns a saved state unchanged after a JSON round trip', () => {
    expect(parseState(fromJson(START))).toStrictEqual(START);
  });

  it('refuses a state without its heading: only version 1 saved one, and migrateState reads it', () => {
    expect(parseState(v1Runs['first-build'])).toBeNull();
  });

  it('returns every state reached by legal play unchanged (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const { states } = played(seed, difficulty, choices);
        expect(states.map((state) => parseState(fromJson(state)))).toStrictEqual(states);
      }),
    );
  });

  it.each([
    ['text', 'garbage'],
    ['null', null],
    ['a missing field', { ...START, score: undefined }],
    ['an extra field', { ...START, cheat: true }],
    ['a field of the wrong type', { ...START, moves: '3' }],
    ['a negative count', { ...START, caught: -1 }],
    ['a difficulty above 100', { ...START, difficulty: 101 }],
    ['a board larger than any tuning row', { ...START, cols: 40 }],
    ['a snake cell off the board', { ...START, snake: [...START.snake.slice(0, -1), 999] }],
    ['a snake that is not one chain', { ...START, snake: [0, 2] }],
    ['a snake that crosses itself', { ...START, snake: [0, 1, 0] }],
    ['a critter on the snake', { ...START, critters: [{ id: 0, cell: START.snake[0] }] }],
    [
      'two critters on one cell',
      {
        ...START,
        critters: [
          { id: 0, cell: 0 },
          { id: 1, cell: 0 },
        ],
      },
    ],
    ['a critter count that does not add up', { ...START, caught: 3 }],
    ['an rng of three words', { ...START, rng: [1, 2, 3] }],
    ['a continue flag that is not a boolean', { ...START, hasContinued: 'no' }],
    ['a heading that is not a direction', { ...START, heading: 'sideways' }],
  ])('refuses %s', (_name, json) => {
    expect(parseState(fromJson(json))).toBeNull();
  });
});

describe('parseMove', () => {
  it('accepts every logged steer', () => {
    for (const direction of ['up', 'right', 'down', 'left'] as const) {
      expect(parseMove({ kind: 'steer', direction })).toStrictEqual({ kind: 'steer', direction });
    }
  });

  it.each([
    [null],
    ['up'],
    [{ kind: 'steer', direction: 'sideways' }],
    [{ kind: 'jump', direction: 'up' }],
    [{ kind: 'steer', direction: 'up', extra: 1 }],
  ])('refuses %j', (json) => {
    expect(parseMove(json)).toBeNull();
  });

  it('rebuilds the same run from the saved move line (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const { moves, end } = playedLine(seed, difficulty, choices);
        expect(replay(create(seed, difficulty), moves)).toStrictEqual(end);
      }),
    );
  });
});

/** Golden: fnv1a-32 (hashSeed) of the frozen version-1 runs; they are what old phones hold. */
const GOLDEN_V1_RUNS_HASH = 4_007_597_916;

/** A state's JSON as the first build wrote it: every field but the heading. */
function withoutHeading(state: SnareSnakeState): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fromJson(state) as object).filter(([key]) => key !== 'heading'),
  );
}

describe('migrateState (version 1 to 2: the heading is always saved)', () => {
  it('keeps the frozen version-1 runs unchanged', () => {
    expect(hashSeed(JSON.stringify(v1Runs))).toBe(GOLDEN_V1_RUNS_HASH);
  });

  it('upgrades a first-build run with no heading: the head looks from its neck (null)', () => {
    const saved = v1Runs['first-build'];
    expect(migrateState(saved, 1)).toStrictEqual({ ...saved, heading: null });
  });

  it('upgrades a version-1 run that saved its heading, keeping it', () => {
    const saved = v1Runs['heading-build'];
    expect(migrateState(saved, 1)).toStrictEqual(saved);
    expect(migrateState(saved, 1)).toStrictEqual(parseState(saved));
  });

  it('upgrades both version-1 shapes of every state reached by legal play (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const { states } = played(seed, difficulty, choices);
        expect(states.map((state) => migrateState(fromJson(state), 1))).toStrictEqual(states);
        expect(states.map((state) => migrateState(withoutHeading(state), 1))).toStrictEqual(
          states.map((state) => ({ ...state, heading: null })),
        );
      }),
    );
  });

  it.each([
    ['a version-0 run', v1Runs['first-build'], 0],
    ['a run already at version 2', v1Runs['heading-build'], 2],
    ['a version-1 run that is not a record', 'garbage', 1],
    ['a version-1 run with a broken count', { ...v1Runs['first-build'], caught: -1 }, 1],
    [
      'a version-1 run with a heading that is no direction',
      { ...v1Runs['heading-build'], heading: 'up-ish' },
      1,
    ],
  ])('refuses %s', (_name, json, fromVersion) => {
    expect(migrateState(json, fromVersion)).toBeNull();
  });
});

describe('SNARE_SNAKE_PERSISTENCE', () => {
  it('is at state version 2 and upgrades version-1 runs with migrateState', () => {
    expect(SNARE_SNAKE_PERSISTENCE.stateVersion).toBe(2);
    expect(SNARE_SNAKE_PERSISTENCE.migrateState).toBe(migrateState);
    expect(SNARE_SNAKE_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });

  it('saves after every move (a turn-based game: every move is written before it is shown)', () => {
    expect(SNARE_SNAKE_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
  });
});
