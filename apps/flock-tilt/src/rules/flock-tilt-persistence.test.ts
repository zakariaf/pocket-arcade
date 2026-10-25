// apps/flock-tilt/src/rules/flock-tilt-persistence.test.ts
import fc from 'fast-check';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import {
  FLOCK_TILT_PERSISTENCE,
  FLOCK_TILT_STATE_VERSION,
  parseMove,
  parseState,
} from './flock-tilt-persistence.ts';
import { listMoves } from './list-moves.ts';

import type { FlockTiltMove, FlockTiltState } from './flock-tilt-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 99 });
const choicesArb = fc.array(fc.nat(), { maxLength: 20 });

/** The JSON a save holds for a value (what the Shell writes after every move). */
function saved(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

const START = create(9, 60);

/** Plays the choices (choice % legal moves) and keeps the move line, like the Shell's log. */
function playLogged(
  start: FlockTiltState,
  choices: readonly number[],
): { moves: FlockTiltMove[]; last: FlockTiltState } {
  const moves: FlockTiltMove[] = [];
  let last = start;
  for (const choice of choices) {
    const legal = listMoves(last);
    if (legal.length === 0) break;
    const move = pickAt(legal, choice % legal.length);
    moves.push(move);
    last = applyMove(last, move).state;
  }
  return { moves, last };
}

function parsedAll(states: readonly FlockTiltState[]): (FlockTiltState | null)[] {
  return states.map((state) => parseState(saved(state)));
}

function parsedMoves(moves: readonly FlockTiltMove[]): (FlockTiltMove | null)[] {
  return moves.map((move) => parseMove(saved(move)));
}

function replay(start: FlockTiltState, moves: readonly FlockTiltMove[]): FlockTiltState {
  return moves.reduce((state, move) => applyMove(state, move).state, start);
}

describe('parseState (spec 8.6: "Saved after every move")', () => {
  it('returns a saved start state unchanged after a JSON round trip', () => {
    expect(parseState(saved(START))).toStrictEqual(START);
  });

  it('keeps a lost state with the flock from before the losing tilt', () => {
    const lost = { ...START, beforeLoss: { sheep: START.sheep, wolves: START.wolves, tilts: 2 } };
    expect(parseState(saved(lost))).toStrictEqual(lost);
  });

  it.each([
    ['text', 'garbage'],
    ['a missing field', { ...START, par: undefined }],
    ['an extra field', { ...START, colour: 'green' }],
    ['a field of the wrong type', { ...START, tilts: '3' }],
    ['a negative tilt count', { ...START, tilts: -1 }],
    ['a rock outside the field', { ...START, rocks: [...START.rocks, 49] }],
    ['rocks out of order', { ...START, rocks: [...START.rocks].reverse() }],
    ['a pen on a rock', { ...START, pen: START.rocks[0] }],
    ['an unknown sheep status', { ...START, sheep: [{ id: 0, cell: 1, status: 'asleep' }] }],
    [
      'a penned sheep outside the pen',
      { ...START, sheep: [{ id: 0, cell: (START.pen + 1) % 49, status: 'penned' }] },
    ],
    ['two animals on one cell', { ...START, wolves: [{ id: 0, cell: START.sheep[0]?.cell ?? 0 }] }],
    ['no sheep at all', { ...START, sheep: [] }],
    ['a broken flock-before', { ...START, beforeLoss: { sheep: [], wolves: [] } }],
    ['a continue flag that is not a boolean', { ...START, hasContinued: 'no' }],
    ['a field too wide to be a field', { ...START, cols: 20 }],
    ['wolves that are not a list', { ...START, wolves: 'wolf' }],
    ['a wolf with an extra field', { ...START, wolves: [{ id: 0, cell: 48, bite: 1 }] }],
    [
      'a sheep with an extra field',
      { ...START, sheep: [{ id: 0, cell: 1, status: 'field', x: 1 }] },
    ],
  ])('refuses %s', (_name, json) => {
    expect(parseState(saved(json))).toBeNull();
  });

  describe('properties', () => {
    it('keeps every state legal play reaches unchanged through a JSON round trip', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          expect(parsedAll(states)).toStrictEqual(states);
        }),
        { numRuns: 40 },
      );
    });

    it('rebuilds the same state by replaying the saved move line', () => {
      fc.assert(
        fc.property(seedArb, choicesArb, (seed, choices) => {
          const start = create(seed, 20);
          const { moves, last } = playLogged(start, choices);
          expect(parsedMoves(moves)).toStrictEqual(moves);
          expect(replay(start, moves)).toStrictEqual(last);
        }),
        { numRuns: 40 },
      );
    });
  });
});

describe('parseMove', () => {
  it('accepts each logged tilt', () => {
    expect(
      ['up', 'right', 'down', 'left'].map((direction) => parseMove({ kind: 'tilt', direction })),
    ).toStrictEqual([
      { kind: 'tilt', direction: 'up' },
      { kind: 'tilt', direction: 'right' },
      { kind: 'tilt', direction: 'down' },
      { kind: 'tilt', direction: 'left' },
    ]);
  });

  it.each([
    [null],
    [{ kind: 'tilt', direction: 'sideways' }],
    [{ kind: 'jump', direction: 'up' }],
    [{ kind: 'tilt', direction: 'up', extra: 1 }],
    [{ kind: 'tilt' }],
  ])('refuses %j (a move that names an impossible target)', (json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('FLOCK_TILT_PERSISTENCE', () => {
  it('is state version 1 and drops a run saved in an older version', () => {
    expect(FLOCK_TILT_PERSISTENCE.stateVersion).toBe(FLOCK_TILT_STATE_VERSION);
    expect(FLOCK_TILT_STATE_VERSION).toBe(1);
    expect(FLOCK_TILT_PERSISTENCE.migrateState(saved(START), 0)).toBeNull();
  });

  it('saves after every move (a turn-based game)', () => {
    expect(FLOCK_TILT_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
  });
});
