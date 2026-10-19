// apps/scrap-shove/src/rules/scrap-shove-persistence.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { continueRun } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { SCRAP_SHOVE_PERSISTENCE, parseMove, parseState } from './scrap-shove-persistence.ts';

import type { ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 100_000 });
const difficultyArb = fc.integer({ min: 0, max: 99 });
const choicesArb = fc.array(fc.nat(), { maxLength: 20 });

function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/** The moves a player made: the saved move line the Shell replays. */
function movesOf(start: ScrapShoveState, choices: readonly number[]): ScrapShoveMove[] {
  const moves: ScrapShoveMove[] = [];
  let state = start;
  for (const choice of choices) {
    const legal = listMoves(state);
    const move = legal[choice % Math.max(legal.length, 1)];
    if (move === undefined) break;
    moves.push(move);
    state = applyMove(state, move).state;
  }
  return moves;
}

const START = create(1, 0);
/** One wait from the catch: the robot next to the player steps onto them. */
const NEXT_TO_ROBOT = stateFromText([
  '........',
  '........',
  '........',
  '...n....',
  '....@...',
  '........',
  '........',
  '......#.',
]);
const LOST = applyMove(NEXT_TO_ROBOT, { kind: 'wait' }).state;

describe('parseState (spec 8.6: a run survives every kill and every update)', () => {
  it('returns every state reached by legal play unchanged after a JSON round trip', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const { states } = playChoices(RULES, create(seed, difficulty), choices);
        const last = states.at(-1);
        expect(parseState(roundTrip(last))).toStrictEqual(last);
        // The same text, key order included: the save is compared and written as JSON text.
        expect(JSON.stringify(parseState(roundTrip(last)))).toBe(JSON.stringify(last));
      }),
      { numRuns: 50 },
    );
  });

  it('keeps a lost run with its rescue floor, and a continued one', () => {
    expect(LOST.caughtBy).not.toBeNull();
    expect(parseState(roundTrip(LOST))).toStrictEqual(LOST);
    const continued = continueRun(LOST).state;
    expect(parseState(roundTrip(continued))).toStrictEqual(continued);
  });

  it.each([
    ['text', 'garbage'],
    ['a wrong field type', { ...START, hasContinued: 'no' }],
    ['a missing field', { ...START, nextId: undefined }],
    ['an extra field', { ...START, score: 10 }],
    ['a square off the floor', { ...START, player: { col: 8, row: 0 } }],
    ['another floor size', { ...START, cols: 9, rows: 9 }],
    ['an unknown robot kind', { ...START, robots: [{ id: 1, kind: 'giant', col: 0, row: 0 }] }],
    [
      'a robot with an extra field',
      { ...START, robots: [{ id: 1, kind: 'normal', col: 0, row: 0, hp: 3 }] },
    ],
    ['a heap without its shoved mark', { ...START, heaps: [{ id: 9, col: 1, row: 1 }] }],
    [
      'a heap whose shoved mark is not true or false',
      { ...START, heaps: [{ id: 9, col: 1, row: 1, isShoved: 'yes' }] },
    ],
    ['a player square with an extra field', { ...START, player: { col: 1, row: 1, layer: 0 } }],
    ['fewer robots in total than on the floor', { ...START, robotsTotal: 1 }],
    ['a catch by a robot that is not there', { ...START, caughtBy: 99 }],
    ['a broken rescue floor', { ...START, caughtBy: 1, rescue: { player: { col: 0, row: 0 } } }],
    ['robots that are not a list', { ...START, robots: 'many' }],
  ])('refuses %s', (_name, json) => {
    expect(parseState(roundTrip(json))).toBeNull();
  });
});

describe('parseMove', () => {
  it('accepts every legal move after a JSON round trip', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        listMoves(create(seed, difficulty)).forEach((move) => {
          expect(parseMove(roundTrip(move))).toStrictEqual(move);
        });
      }),
      { numRuns: 30 },
    );
  });

  it.each([
    [null],
    [{ kind: 'step', col: 8, row: 0 }],
    [{ kind: 'shove', col: 0, row: -1 }],
    [{ kind: 'jump', col: 0, row: 0 }],
    [{ kind: 'fly' }],
    [{ kind: 'wait', col: 0 }],
    [{ kind: 'step', col: 1.5, row: 0 }],
  ])('refuses %j', (json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('the saved move line', () => {
  it('rebuilds the same state when replayed from the start', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const start = create(seed, difficulty);
        const saved = roundTrip(movesOf(start, choices));
        const parsed = Array.isArray(saved) ? saved.map((move: unknown) => parseMove(move)) : [];
        const replayed = parsed.reduce<ScrapShoveState>(
          (state, move) => (move === null ? state : applyMove(state, move).state),
          start,
        );
        expect(replayed).toStrictEqual(playChoices(RULES, start, choices).states.at(-1));
      }),
      { numRuns: 30 },
    );
  });
});

describe('SCRAP_SHOVE_PERSISTENCE', () => {
  it('drops a run saved in an older state version (version 1 has nothing to migrate)', () => {
    expect(SCRAP_SHOVE_PERSISTENCE.migrateState(START, 0)).toBeNull();
    expect(SCRAP_SHOVE_PERSISTENCE.stateVersion).toBe(1);
  });

  it('saves after every move (a turn-based game: every move is written before it is shown)', () => {
    expect(SCRAP_SHOVE_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
  });
});
