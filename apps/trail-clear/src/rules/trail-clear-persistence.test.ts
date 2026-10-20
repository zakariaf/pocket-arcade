// apps/trail-clear/src/rules/trail-clear-persistence.test.ts
// Spec 8.6 and N10: a run survives every kill and every update; a saved run that no longer parses
// is dropped alone (8.14), never a crash.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { TRAIL_CLEAR_PERSISTENCE, parseMove, parseState } from './trail-clear-persistence.ts';

import type { TrailClearMove, TrailClearState } from './trail-clear-types.ts';

const RULES = { listMoves, applyMove };
const START = create(1, 0);
const TILE = { kind: 'road-end', turns: 1, placedAt: 3 };

/** A seeded line of play and its states. */
function played(seed: number, difficulty: number, choices: readonly number[]) {
  return playChoices(RULES, create(seed, difficulty), choices);
}

/** The moves a run's choices pick, replayed from the start. */
function movesOf(start: TrailClearState, choices: readonly number[]): TrailClearMove[] {
  const moves: TrailClearMove[] = [];
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

function replay(start: TrailClearState, moves: readonly TrailClearMove[]): TrailClearState {
  return moves.reduce((state, move) => applyMove(state, move).state, start);
}

describe('parseState', () => {
  it('returns a saved state unchanged after a JSON round trip', () => {
    const state = create(9, 60);
    expect(parseState(JSON.parse(JSON.stringify(state)))).toStrictEqual(state);
  });

  it('returns any state reached by play unchanged (the save is written after every move)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 30 }),
        (seed, difficulty, choices) => {
          const last = played(seed, difficulty, choices).states.at(-1);
          expect(parseState(JSON.parse(JSON.stringify(last)))).toStrictEqual(last);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('gives back the same bytes, keys in the same order (the save compares JSON text)', () => {
    const state = create(4, 30);
    expect(JSON.stringify(parseState(JSON.parse(JSON.stringify(state))))).toBe(
      JSON.stringify(state),
    );
  });

  it('keeps an empty bag (offered null) and a finished continue', () => {
    const won = { ...START, offered: null, hasContinued: true };
    expect(parseState(JSON.parse(JSON.stringify(won)))).toStrictEqual(won);
  });

  it.each([
    ['text', 'garbage'],
    ['a missing field', { ...START, score: undefined }],
    ['a field of the wrong type', { ...START, hasContinued: 'yes' }],
    ['an extra field', { ...START, hearts: 3 }],
    ['cells of the wrong length', { ...START, cells: [null, null] }],
    ['cells that are not a list', { ...START, cells: {} }],
    [
      'a tile of an unknown kind',
      { ...START, cells: START.cells.map(() => ({ ...TILE, kind: 'tunnel' })) },
    ],
    [
      'a tile turned five times',
      { ...START, cells: START.cells.map(() => ({ ...TILE, turns: 5 })) },
    ],
    [
      'a tile with an extra field',
      { ...START, cells: START.cells.map(() => ({ ...TILE, colour: 1 })) },
    ],
    ['an offered tile of an unknown kind', { ...START, offered: 'tunnel' }],
    ['a difficulty above 100', { ...START, difficulty: 101 }],
    ['a negative score', { ...START, score: -10 }],
    ['an RNG state of three words', { ...START, rng: [1, 2, 3] }],
    ['an RNG word above 32 bits', { ...START, rng: [1, 2, 3, 2 ** 33] }],
  ])('refuses %s', (_, json) => {
    expect(parseState(JSON.parse(JSON.stringify(json)))).toBeNull();
  });
});

describe('parseMove', () => {
  it('returns every legal move unchanged (property)', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
        for (const move of listMoves(create(seed, difficulty))) {
          expect(parseMove(JSON.parse(JSON.stringify(move)))).toStrictEqual(move);
        }
      }),
      { numRuns: 30 },
    );
  });

  it.each([
    ['another kind', { kind: 'rotate-tile', turns: 1, col: 0, row: 0 }],
    ['a cell off the board', { kind: 'place-tile', turns: 0, col: 5, row: 0 }],
    ['a turn past three', { kind: 'place-tile', turns: 4, col: 0, row: 0 }],
    ['a part cell', { kind: 'place-tile', turns: 0, col: 1.5, row: 0 }],
    ['an extra field', { kind: 'place-tile', turns: 0, col: 0, row: 0, tray: 1 }],
    ['not an object', 7],
  ])('refuses %s', (_, json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('TRAIL_CLEAR_PERSISTENCE', () => {
  it('saves after every move, at state version 1, with nothing older to migrate', () => {
    expect(TRAIL_CLEAR_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
    expect(TRAIL_CLEAR_PERSISTENCE.stateVersion).toBe(1);
    expect(TRAIL_CLEAR_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });

  it('rebuilds the same state from a replay of the saved move line (property)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 30 }),
        (seed, difficulty, choices) => {
          const start = create(seed, difficulty);
          const saved = movesOf(start, choices).map((move) =>
            parseMove(JSON.parse(JSON.stringify(move))),
          );
          const last = played(seed, difficulty, choices).states.at(-1);
          expect(
            replay(
              start,
              saved.filter((move) => move !== null),
            ),
          ).toStrictEqual(last);
        },
      ),
      { numRuns: 40 },
    );
  });
});
