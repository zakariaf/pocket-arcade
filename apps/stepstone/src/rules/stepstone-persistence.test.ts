// apps/stepstone/src/rules/stepstone-persistence.test.ts
// Spec 8.6: a run survives every kill and every update (it is saved after every move). Spec 8.14:
// a saved run that no longer parses is dropped alone and logged, never a crash.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import {
  parseMove,
  parseState,
  STEPSTONE_PERSISTENCE,
  STEPSTONE_STATE_VERSION,
} from './stepstone-persistence.ts';

import type { StepstoneMove, StepstoneState } from './stepstone-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat({ max: 60 }), { maxLength: 12 });

function viaJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function statesOf(seed: number, difficulty: number, choices: readonly number[]) {
  return playChoices(RULES, create(seed, difficulty), choices).states;
}

/** The hops a run made, read back from its states (each hop lands on the next frog cell). */
function hopsOf(states: readonly StepstoneState[]): StepstoneMove[] {
  return states.slice(1).map((state) => ({ kind: 'hop', to: state.frog }));
}

function replay(start: StepstoneState, saved: readonly unknown[]): StepstoneState {
  return saved.reduce<StepstoneState>((state, json) => {
    const move = parseMove(json);
    if (move === null) throw new Error(`saved hop ${JSON.stringify(json)} did not parse`);
    return applyMove(state, move).state;
  }, start);
}

function expectEveryHopReadBack(state: StepstoneState): void {
  for (const move of listMoves(state)) expect(parseMove(viaJson(move))).toStrictEqual(move);
}

const START = create(1, 0);

describe('parseState', () => {
  it('returns every state that legal hops reach unchanged after a JSON round trip', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        for (const state of statesOf(seed, difficulty, choices)) {
          expect(parseState(viaJson(state))).toStrictEqual(state);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('writes back the same JSON text, keys in the same order, for every state legal hops reach', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        for (const state of statesOf(seed, difficulty, choices)) {
          expect(JSON.stringify(parseState(viaJson(state)))).toBe(JSON.stringify(state));
        }
      }),
      { numRuns: 50 },
    );
  });

  it('reads the frozen version 1 save of a small pond', () => {
    expect(parseState(GOLDEN_SAVE_V1)).toStrictEqual(GOLDEN_SAVE_V1);
  });

  it.each([
    ['text', 'garbage'],
    ['null', null],
    ['an array', [START]],
    ['a missing field (par)', { ...START, par: undefined }],
    ['an extra field (an rng)', { ...START, rng: [1, 2, 3, 4] }],
    ['a side of the wrong type', { ...START, side: '5' }],
    [
      'a side no pond has',
      { ...START, side: 12, cells: Array.from({ length: 144 }, () => 'water') },
    ],
    ['cells of the wrong length', { ...START, cells: START.cells.slice(1) }],
    [
      'an unknown cell',
      { ...START, cells: START.cells.map((cell) => (cell === 'water' ? 'lava' : cell)) },
    ],
    [
      'a pond without its flag',
      { ...START, cells: START.cells.map((cell) => (cell === 'flag' ? 'water' : cell)) },
    ],
    ['a frog outside the pond', { ...START, frog: 25 }],
    ['a frog in the water', { ...START, frog: 0 }],
    ['a negative hop count', { ...START, moves: -1 }],
    ['a par that is not a whole number', { ...START, par: 2.5 }],
    ['hop kinds that are not a list', { ...START, kindsUsed: 'rook' }],
    ['an unknown hop kind used', { ...START, kindsUsed: ['rook', 'queen'] }],
    ['a hop kind listed twice', { ...START, kindsUsed: ['rook', 'rook'] }],
  ])('refuses %s', (_reason, json) => {
    expect(parseState(viaJson(json))).toBeNull();
  });
});

describe('parseMove', () => {
  it('reads every legal hop back from its JSON', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        statesOf(seed, difficulty, choices).forEach(expectEveryHopReadBack);
      }),
      { numRuns: 100 },
    );
  });

  it.each([
    ['null', null],
    ['another move kind', { kind: 'jump', to: 1 }],
    ['a target before the first cell', { kind: 'hop', to: -1 }],
    ['a target between cells', { kind: 'hop', to: 1.5 }],
    ['a target past the largest pond', { kind: 'hop', to: 81 }],
    ['a target of the wrong type', { kind: 'hop', to: '3' }],
    ['an extra field', { kind: 'hop', to: 3, from: 2 }],
  ])('refuses %s', (_reason, json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('STEPSTONE_PERSISTENCE', () => {
  it('rebuilds the same state by replaying the saved hop line from the start', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const states = statesOf(seed, difficulty, choices);
        const saved = hopsOf(states).map(viaJson);
        expect(replay(create(seed, difficulty), saved)).toStrictEqual(states.at(-1));
      }),
      { numRuns: 100 },
    );
  });

  it('saves after every move and drops a run of an older state version', () => {
    expect(STEPSTONE_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
    expect(STEPSTONE_PERSISTENCE.stateVersion).toBe(STEPSTONE_STATE_VERSION);
    expect(STEPSTONE_STATE_VERSION).toBe(1);
    expect(STEPSTONE_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });
});

/** A version 1 save, frozen: a 3 x 3 pond one hop in, the frog on the king. */
const GOLDEN_SAVE_V1 = {
  side: 3,
  cells: ['sunk', 'water', 'flag', 'water', 'king', 'water', 'rook', 'water', 'water'],
  frog: 4,
  moves: 1,
  par: 2,
  kindsUsed: ['bishop', 'king'],
};
