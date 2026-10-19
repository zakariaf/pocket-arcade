// apps/jump-chain/src/rules/jump-chain-persistence.test.ts
// Spec 8.6 and N10: a run survives every kill and every update; spec 8.14: a saved run that no
// longer parses is dropped alone, never a crash.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { JUMP_CHAIN_PERSISTENCE, parseMove, parseState } from './jump-chain-persistence.ts';
import { listMoves } from './list-moves.ts';

import type { JumpChainMove, JumpChainState } from './jump-chain-types.ts';

const RULES = { listMoves, applyMove };
const START = create(1, 0);
const seedArb = fc.nat();
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 30 });

/** What the save holds: the value after a JSON round trip. */
function saved(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/** The start state as a plain record, to plant one bad field at a time. */
function startRecord(): Record<string, unknown> {
  return saved(START) as Record<string, unknown>;
}

/** Replays a move line from its start: the run a save restores. */
function replay(start: JumpChainState, moves: readonly JumpChainMove[]): JumpChainState {
  return moves.reduce((state, move) => applyMove(state, move).state, start);
}

/** Every state and move of a played line comes back unchanged from the save. */
function expectRoundTrips(states: readonly JumpChainState[]): void {
  for (const state of states) {
    expect(parseState(saved(state))).toStrictEqual(state);
    for (const move of listMoves(state)) expect(parseMove(saved(move))).toStrictEqual(move);
  }
}

describe('parseState', () => {
  it('returns a saved start unchanged, the endless run included', () => {
    expect(parseState(saved(START))).toStrictEqual(START);
    const endless = create(4, ENDLESS_DIFFICULTY);
    expect(parseState(saved(endless))).toStrictEqual(endless);
  });

  it('returns every state reached by legal play unchanged, and every move it lists', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        expectRoundTrips(playChoices(RULES, create(seed, difficulty), choices).states);
      }),
      { numRuns: 40 },
    );
  });

  it.each([
    ['text', 'garbage'],
    ['a missing field', { ...startRecord(), score: undefined }],
    ['an extra field', { ...startRecord(), lives: 3 }],
    ['a field of the wrong type', { ...startRecord(), hasContinued: 'no' }],
    ['a difficulty above 100', { ...startRecord(), difficulty: 101 }],
    ['a negative score', { ...startRecord(), score: -1 }],
    ['a piece that is not a square', { ...startRecord(), piece: 7 }],
    ['a piece off the board', { ...startRecord(), piece: { col: 7, row: 7 } }],
    ['a piece on a light square', { ...startRecord(), piece: { col: 3, row: 6 } }],
    ['enemies that are not a list', { ...startRecord(), enemies: {} }],
    [
      'an enemy on an even row',
      { ...startRecord(), enemies: [{ id: 0, rank: 0, col: 2, row: 4 }], total: 1 },
    ],
    [
      'an enemy past your side',
      { ...startRecord(), enemies: [{ id: 0, rank: 0, col: 3, row: 11 }], total: 1 },
    ],
    [
      'an enemy with an extra field',
      { ...startRecord(), enemies: [{ id: 0, rank: 0, col: 3, row: 5, hp: 2 }], total: 1 },
    ],
    [
      'two enemies with one id',
      {
        ...startRecord(),
        enemies: [
          { id: 0, rank: 0, col: 3, row: 5 },
          { id: 0, rank: 0, col: 1, row: 5 },
        ],
        total: 2,
      },
    ],
    ['counts that do not add up', { ...startRecord(), captured: 5 }],
    ['an id at or above nextId', { ...startRecord(), nextId: 0 }],
    ['an RNG state of three words', { ...startRecord(), rng: [1, 2, 3] }],
    ['an RNG word above 32 bits', { ...startRecord(), rng: [1, 2, 3, 2 ** 33] }],
  ])('rejects %s', (_name, json) => {
    expect(parseState(json)).toBeNull();
  });
});

describe('parseMove', () => {
  it('accepts a logged step and a logged chain', () => {
    expect(parseMove({ kind: 'step', to: { col: 2, row: 6 } })).toStrictEqual({
      kind: 'step',
      to: { col: 2, row: 6 },
    });
    const chain = {
      kind: 'jump',
      path: [
        { col: 4, row: 4 },
        { col: 6, row: 2 },
      ],
    };
    expect(parseMove(chain)).toStrictEqual(chain);
  });

  it.each([
    [null],
    [{ kind: 'step', to: { col: 7, row: 6 } }],
    [{ kind: 'step', to: { col: 3, row: 6 } }],
    [{ kind: 'step', to: { col: 2, row: 6 }, extra: 1 }],
    [{ kind: 'jump', path: [] }],
    [
      {
        kind: 'jump',
        path: [
          { col: 4, row: 4 },
          { col: 5, row: 3 },
        ],
      },
    ],
    [
      {
        kind: 'jump',
        path: [
          { col: 4, row: 4 },
          { col: 4, row: 0 },
        ],
      },
    ],
    [{ kind: 'jump', path: 'up' }],
    [{ kind: 'jump', path: [{ col: 4, row: 4 }], extra: 1 }],
    [
      {
        kind: 'jump',
        path: Array.from({ length: 71 }, (_, index) => ({
          col: (index % 2) * 2,
          row: (index % 2) * 2,
        })),
      },
    ],
    [{ kind: 'wait' }],
  ])('rejects %j', (json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('a saved run', () => {
  it('replays its saved move line to the same state', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const start = create(seed, difficulty);
        const line: JumpChainMove[] = [];
        let state = start;
        for (const choice of choices) {
          const moves = listMoves(state);
          const move = moves[choice % Math.max(moves.length, 1)];
          if (move === undefined) break;
          line.push(move);
          state = applyMove(state, move).state;
        }
        const restored = line.map((move) => parseMove(saved(move)));
        expect(restored.every((move) => move !== null)).toBe(true);
        expect(replay(start, line)).toStrictEqual(state);
      }),
      { numRuns: 40 },
    );
  });
});

describe('JUMP_CHAIN_PERSISTENCE', () => {
  it('drops a run saved in an older state version (version 1 has nothing to migrate)', () => {
    expect(JUMP_CHAIN_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });

  it('saves after every move (a turn-based game)', () => {
    expect(JUMP_CHAIN_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
    expect(JUMP_CHAIN_PERSISTENCE.stateVersion).toBe(GOLDEN_STATE_VERSION);
  });
});

const GOLDEN_STATE_VERSION = 1;
