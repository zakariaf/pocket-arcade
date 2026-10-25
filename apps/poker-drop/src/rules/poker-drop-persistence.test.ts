// apps/poker-drop/src/rules/poker-drop-persistence.test.ts
import fc from 'fast-check';

import { applyMove } from './apply-move.ts';
import { cardOf } from './cards.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { POKER_DROP_PERSISTENCE, parseMove, parseState } from './poker-drop-persistence.ts';

import type { PokerDropMove, PokerDropState } from './poker-drop-types.ts';

const START = create(1, 0);
type Line = { readonly states: PokerDropState[]; readonly moves: PokerDropMove[] };

/** The states and moves of a legal line: each choice picks one of the listed moves. */
function playLine(seed: number, difficulty: number, choices: readonly number[]): Line {
  const line: Line = { states: [create(seed, difficulty)], moves: [] };
  for (const choice of choices) {
    const state = line.states.at(-1) ?? START;
    const moves = listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    line.moves.push(move);
    line.states.push(applyMove(state, move).state);
  }
  return line;
}

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;
const parsesBack = (state: PokerDropState): boolean =>
  JSON.stringify(parseState(roundTrip(state))) === JSON.stringify(state);
const movesBack = (move: PokerDropMove): boolean =>
  JSON.stringify(parseMove(roundTrip(move))) === JSON.stringify(move);

describe('parseState', () => {
  // spec 8.6 and N10: a run survives every kill and every app update; a saved run that no longer
  // parses is dropped alone (8.14).
  it('returns a saved state unchanged after a JSON round trip', () => {
    const state = create(9, 60);
    expect(parseState(roundTrip(state))).toStrictEqual(state);
  });

  it('returns every state reached by play unchanged (the save is written after every move)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 30 }),
        (seed, difficulty, choices) => {
          expect(playLine(seed, difficulty, choices).states.every(parsesBack)).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('rebuilds the same state by replaying the saved move line', () => {
    const { states, moves } = playLine(5, 30, [3, 1, 4, 1, 5, 9, 2, 6]);
    const parsed = moves.map((move) => parseMove(roundTrip(move)));
    const replayed = parsed.reduce<PokerDropState>(
      (state, move) => (move === null ? state : applyMove(state, move).state),
      create(5, 30),
    );
    expect(replayed).toStrictEqual(states.at(-1));
  });

  it.each([
    ['text', 'garbage'],
    ['a missing field', { ...START, hand: undefined }],
    ['an extra field', { ...START, cheat: true }],
    ['cells of the wrong length', { ...START, cells: [0, 1] }],
    ['a cell that is no card', { ...START, cells: START.cells.map(() => 52) }],
    ['a hand that is no card', { ...START, hand: -1 }],
    ['a next card that is text', { ...START, next: 'Ks' }],
    ['a pile with a card out of range', { ...START, pile: [0, 99] }],
    ['a pile that is not a list', { ...START, pile: {} }],
    ['an RNG state of no words', { ...START, rng: [] }],
    ['an RNG state of one word', { ...START, rng: [1] }],
    ['an RNG state of two words', { ...START, rng: [1, 2] }],
    ['an RNG state of three words', { ...START, rng: [1, 2, 3] }],
    ['an RNG state of five words', { ...START, rng: [1, 2, 3, 4, 5] }],
    ['an RNG state that is not a list', { ...START, rng: 7 }],
    ['an RNG word above 32 bits', { ...START, rng: [1, 2, 3, 2 ** 33] }],
    ['a difficulty above 100', { ...START, difficulty: 101 }],
    ['a negative score', { ...START, score: -1 }],
    ['a goal that is not whole', { ...START, goal: 2.5 }],
    ['a continue flag that is not a boolean', { ...START, hasContinued: 'no' }],
    ['an overflow flag that is missing', { ...START, hasOverflowed: undefined }],
  ])('rejects %s', (_name, json) => {
    expect(parseState(roundTrip(json))).toBeNull();
  });
});

/** A played state with hands made: seed 1's line of leftmost drops, after its first burst. */
const PLAYED = (() => {
  const { states } = playLine(
    1,
    0,
    Array.from({ length: 30 }, () => 0),
  );
  return states.find((state) => state.handsMade > 0) ?? START;
})();
const LOW_CARD = cardOf(2, 0);

describe('parseState with counts or cards no play can reach', () => {
  it('starts from a played state that parses (the cases below change one thing each)', () => {
    expect(PLAYED.handsMade).toBeGreaterThan(0);
    expect(parseState(roundTrip(PLAYED))).toStrictEqual(PLAYED);
  });

  // spec 8.6 and N10: a damaged save is dropped alone (8.14), never played as an impossible run.
  it.each([
    ['a goal that disagrees with the difficulty', { ...START, goal: START.goal + 1 }],
    ['a hand below the lowest rank of its row', { ...START, hand: LOW_CARD }],
    [
      'a well card below the lowest rank of its row',
      { ...START, cells: START.cells.map((c) => (c === null ? c : LOW_CARD)) },
    ],
    [
      'a pile card below the lowest rank of its row',
      { ...START, pile: [LOW_CARD, ...START.pile.slice(1)] },
    ],
    [
      'the same card twice in the pile',
      { ...START, pile: [START.pile[0], ...START.pile.slice(0, -1)] },
    ],
    ['hands made with no score', { ...PLAYED, score: 0 }],
    ['a score with no hand made', { ...START, score: 20 }],
    [
      'a score below the weakest hand for each hand made',
      { ...PLAYED, score: 10 * PLAYED.handsMade },
    ],
    ['a score no sum of hands makes', { ...PLAYED, score: PLAYED.score + 5 }],
    ['hands made before any drop', { ...START, handsMade: 1, score: 20 }],
  ])('rejects %s', (_name, json) => {
    expect(parseState(roundTrip(json))).toBeNull();
  });
});

describe('parseMove', () => {
  it('accepts every legal drop of a played line', () => {
    fc.assert(
      fc.property(fc.nat(), fc.array(fc.nat(), { maxLength: 20 }), (seed, choices) => {
        expect(playLine(seed, 40, choices).moves.every(movesBack)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  it.each([
    [null],
    [{ kind: 'drop-card', col: 5 }],
    [{ kind: 'drop-card', col: -1 }],
    [{ kind: 'drop-card', col: 1.5 }],
    [{ kind: 'drop-card' }],
    [{ kind: 'drop-card', col: 2, row: 0 }],
    [{ kind: 'rotate-card', col: 0 }],
  ])('rejects %j', (json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('POKER_DROP_PERSISTENCE', () => {
  it('drops a run saved in an older state version (version 1 has nothing to migrate)', () => {
    expect(POKER_DROP_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });

  it('saves after every move (a turn-based game; the cascade is replayed, never saved mid-way)', () => {
    expect(POKER_DROP_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
    expect(POKER_DROP_PERSISTENCE.stateVersion).toBe(GOLDEN_STATE_VERSION);
  });
});

const GOLDEN_STATE_VERSION = 1;
