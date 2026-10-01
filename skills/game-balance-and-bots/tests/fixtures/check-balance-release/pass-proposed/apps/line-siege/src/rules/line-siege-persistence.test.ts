// apps/line-siege/src/rules/line-siege-persistence.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { LINE_SIEGE_PERSISTENCE, parseMove, parseState } from './line-siege-persistence.ts';
import { listMoves } from './list-moves.ts';

const START = create(1, 0);

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
          const { states } = playChoices(
            { listMoves, applyMove },
            create(seed, difficulty),
            choices,
          );
          const last = states.at(-1);
          expect(parseState(JSON.parse(JSON.stringify(last)))).toStrictEqual(last);
        },
      ),
      { numRuns: 50 },
    );
  });

  it.each([
    ['text', 'garbage'],
    ['a missing field', { ...START, hearts: undefined }],
    ['cells of the wrong length', { ...START, cells: [0, 1] }],
    ['a cell that is not 0 or 1', { ...START, cells: START.cells.map(() => 2) }],
    ['a tray of the wrong size', { ...START, tray: [1, 2] }],
    ['a tray piece that does not exist', { ...START, tray: [99, 1, 2] }],
    [
      'a monster of an unknown kind',
      { ...START, monsters: [{ id: 1, kind: 'ghost', lane: 0, row: 0, hp: 3 }] },
    ],
    [
      'a monster outside the lanes',
      { ...START, monsters: [{ id: 1, kind: 'fast', lane: 8, row: 0, hp: 3 }] },
    ],
    [
      'a monster without health',
      { ...START, monsters: [{ id: 1, kind: 'normal', lane: 0, row: 0, hp: 0 }] },
    ],
    ['monsters that are not a list', { ...START, monsters: {} }],
    ['an RNG state of three words', { ...START, rng: [1, 2, 3] }],
    ['an RNG word above 32 bits', { ...START, rng: [1, 2, 3, 2 ** 33] }],
    ['a difficulty above 100', { ...START, difficulty: 101 }],
    ['a negative score', { ...START, score: -1 }],
  ])('rejects %s', (_name, json) => {
    expect(parseState(json)).toBeNull();
  });
});

describe('parseMove', () => {
  it('accepts a logged placement', () => {
    expect(parseMove({ kind: 'place-block', trayIndex: 2, col: 7, row: 0 })).toStrictEqual({
      kind: 'place-block',
      trayIndex: 2,
      col: 7,
      row: 0,
    });
  });

  it.each([
    [null],
    [{ kind: 'place-block', trayIndex: 3, col: 0, row: 0 }],
    [{ kind: 'place-block', trayIndex: 0, col: -1, row: 0 }],
    [{ kind: 'place-block', trayIndex: 0, col: 0, row: 8 }],
    [{ kind: 'rotate-block', trayIndex: 0, col: 0, row: 0 }],
  ])('rejects %j', (json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('LINE_SIEGE_PERSISTENCE', () => {
  it('drops a run saved in an older state version (version 1 has nothing to migrate)', () => {
    expect(LINE_SIEGE_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });

  it('saves after every move (a turn-based game)', () => {
    expect(LINE_SIEGE_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
    expect(LINE_SIEGE_PERSISTENCE.stateVersion).toBe(GOLDEN_STATE_VERSION);
  });
});

const GOLDEN_STATE_VERSION = 1;
