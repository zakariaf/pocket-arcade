// apps/merge-siege/src/rules/merge-siege-persistence.test.ts
// Spec 8.6 and N10: a run survives every kill and every app update. parseState and parseMove accept
// exactly what the rules produce and refuse anything else (the Shell then drops only that run,
// spec 8.14); the save policy writes every move before it is shown.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { MERGE_SIEGE_PERSISTENCE, parseMove, parseState } from './merge-siege-persistence.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const START: MergeSiegeState = create(1, 0);
const EMPTY_CELL = START.cells.indexOf(null);
const withCell = (index: number, cell: unknown): unknown => ({
  ...START,
  cells: START.cells.map((existing, at) => (at === index ? cell : existing)),
});

describe('parseState', () => {
  it('returns a saved start unchanged after a JSON round trip', () => {
    expect(parseState(roundTrip(START))).toStrictEqual(START);
  });

  it.each([
    ['text', 'garbage'],
    ['a list', [START]],
    ['a missing field', { ...START, score: undefined }],
    ['an extra field', { ...START, hearts: 3 }],
    ['a difficulty above 100', { ...START, difficulty: 101 }],
    ['a fractional score', { ...START, score: 1.5 }],
    ['a negative swipe count', { ...START, swipes: -1 }],
    ['a continue flag that is not a boolean', { ...START, hasContinued: 'no' }],
    ['a board of the wrong size', { ...START, cells: START.cells.slice(1) }],
    ['a piece number that is not a power of two', withCell(0, { id: 99, kind: 'tile', value: 6 })],
    ['a piece of an unknown kind', withCell(0, { id: 99, kind: 'wall', value: 2 })],
    ['a piece with an extra field', withCell(0, { id: 99, kind: 'tile', value: 2, hp: 1 })],
    ['a next enemy outside the board', { ...START, next: { col: 5, value: 4 } }],
    ['a next enemy that is not an object', { ...START, next: 'soon' }],
    ['a piece number below 2', withCell(0, { id: 99, kind: 'tile', value: 1 })],
    ['a random stream of the wrong length', { ...START, rng: [1, 2, 3] }],
    ['a random stream with a negative word', { ...START, rng: [1, 2, 3, -4] }],
    ['two pieces with the same id', withCell(EMPTY_CELL, { id: 1, kind: 'tile', value: 2 })],
    ['a next id already used on the board', { ...START, nextId: 5 }],
    ['a next id below a piece id', withCell(EMPTY_CELL, { id: 6, kind: 'tile', value: 2 })],
  ])('rejects %s', (_name, json) => {
    expect(parseState(roundTrip(json) ?? json)).toBeNull();
  });

  it('keeps a run whose whole wave has entered (next null)', () => {
    const done = { ...START, next: null };
    expect(parseState(roundTrip(done))).toStrictEqual(done);
  });

  describe('properties', () => {
    it('returns every state reached by legal swipes unchanged after a JSON round trip', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          for (const state of states) expect(parseState(roundTrip(state))).toStrictEqual(state);
        }),
      );
    });

    it('rebuilds the same state by replaying the saved move line', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          expectReplayMatches(seed, difficulty, choices);
        }),
      );
    });
  });
});

describe('parseMove', () => {
  it.each(['up', 'down', 'left', 'right'] as const)('accepts a logged swipe %s', (direction) => {
    expect(parseMove(roundTrip({ kind: 'swipe', direction }))).toStrictEqual({
      kind: 'swipe',
      direction,
    });
  });

  it.each([
    [null],
    [{ kind: 'swipe', direction: 'diagonal' }],
    [{ kind: 'tap', direction: 'up' }],
    [{ kind: 'swipe', direction: 'up', extra: 1 }],
  ])('rejects %j', (json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('MERGE_SIEGE_PERSISTENCE', () => {
  it('drops a run saved in an older state version (version 1 has nothing to migrate)', () => {
    expect(MERGE_SIEGE_PERSISTENCE.migrateState(START, 0)).toBeNull();
    expect(MERGE_SIEGE_PERSISTENCE.stateVersion).toBe(1);
  });

  it('saves after every move (a turn-based game)', () => {
    expect(MERGE_SIEGE_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
  });
});

function expectReplayMatches(seed: number, difficulty: number, choices: readonly number[]): void {
  const log: unknown[] = [];
  let state = create(seed, difficulty);
  for (const choice of choices) {
    const moves = listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    log.push(roundTrip(move));
    state = applyMove(state, move).state;
  }
  let replayed = create(seed, difficulty);
  for (const json of log) {
    const move = parseMove(json);
    if (move === null) throw new Error('a logged move did not parse');
    replayed = applyMove(replayed, move).state;
  }
  expect(replayed).toStrictEqual(state);
}
