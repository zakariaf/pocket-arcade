// apps/toggle-drop/src/rules/toggle-drop-persistence.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';
import { TOGGLE_DROP_TEACHING } from '@e07/toggle-drop/tutorial/toggle-drop-teaching.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { TOGGLE_DROP_PERSISTENCE, parseMove, parseState } from './toggle-drop-persistence.ts';

import type { ToggleDropMove, ToggleDropState } from './toggle-drop-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 99 });
const choicesArb = fc.array(fc.nat(), { maxLength: 10 });

/** The moves playChoices plays for these choices (the move line a save keeps). */
function playedMoves(start: ToggleDropState, choices: readonly number[]): ToggleDropMove[] {
  const moves: ToggleDropMove[] = [];
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

/** A run through the JSON a save would hold. */
const throughJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('parseState', () => {
  // Spec 8.6 and N10: a saved run survives every kill and update; a run that no longer parses is
  // dropped alone (8.14), never a crash.
  it('returns every state legal play reaches unchanged, byte for byte, after a JSON round trip', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const { states } = playChoices(RULES, create(seed, difficulty), choices);
        const parsed = states.map((state) => parseState(throughJson(state)));
        expect(parsed).toStrictEqual(states);
        expect(JSON.stringify(parsed)).toBe(JSON.stringify(states));
      }),
    );
  });

  it.each([
    ['text', 'garbage'],
    ['an array', [1, 2]],
    ['a missing field', { ...create(1, 0), drops: undefined }],
    ['a wrong field type', { ...create(1, 0), ballsLeft: '6' }],
    ['a switch that is not -1, 0 or 1', { ...create(1, 0), pegs: create(1, 0).pegs.map(() => 2) }],
    ['pegs of the wrong length', { ...create(1, 0), pegs: [0, 1] }],
    [
      'a flip count where there is no switch',
      { ...create(1, 0), flips: create(1, 0).pegs.map((peg) => (peg === -1 ? 1 : 0)) },
    ],
    [
      'a cup holding more than it needs',
      { ...create(1, 0), filled: create(1, 0).needs.map((need) => need + 1) },
    ],
    ['a negative ball count', { ...create(1, 0), ballsLeft: -1 }],
    ['a board wider than any tuning row', { ...create(1, 0), cols: 40 }],
    ['an extra field', { ...create(1, 0), rng: [1, 2, 3, 4] }],
  ])('refuses %s', (_name, json) => {
    expect(parseState(throughJson(json))).toBeNull();
  });
});

/** The easiest board of seed 1 (5 x 3, two switches a row, cups under 1 and 3, six balls). */
const EASY = create(1, 0);

/** A 6 x 3 board: a size between the tuning rows, with arrays that fit it. */
const ODD_SIZE = {
  ...EASY,
  cols: 6,
  pegs: [1, -1, -1, 0, -1, -1, 0, 1, -1, -1, -1, -1, -1, -1, 0, -1, 1, -1],
  flips: Array.from({ length: 18 }, () => 0),
  needs: [0, 1, 0, 1, 0, 0],
  filled: [0, 0, 0, 0, 0, 0],
};

describe('parseState with runs legal play cannot reach', () => {
  // Spec 8.6, 8.14 and N10: a damaged save is dropped alone, so a state no run can reach never
  // loads to break later.
  it.each([
    ['a board size no tuning row has', ODD_SIZE],
    ['balls left and dropped that do not add up to the row', { ...EASY, ballsLeft: 5 }],
    ['a peg row with a switch missing', { ...EASY, pegs: [-1, ...EASY.pegs.slice(1)] }],
    ['a board without a cup', { ...EASY, needs: [0, 0, 0, 0, 0], filled: [0, 0, 0, 0, 0] }],
    ['more cups than the row has', { ...EASY, needs: [1, 1, 0, 1, 0] }],
    ['cups needing more balls than the winning line drops', { ...EASY, needs: [0, 2, 0, 1, 0] }],
    ['a cup holding a ball no drop brought', { ...EASY, filled: [0, 1, 0, 0, 0] }],
    ['a switch flipped by no drop', { ...EASY, flips: [1, ...EASY.flips.slice(1)] }],
  ])('refuses %s', (_name, json) => {
    expect(parseState(throughJson(json))).toBeNull();
  });

  /** EASY after one drop, its flips replaced: one ball meets each peg row once. */
  const AFTER_ONE = applyMove(EASY, { kind: 'drop', col: 0 }).state;
  const switchesOfRow = (row: number): number[] =>
    AFTER_ONE.pegs.flatMap((peg, index) =>
      peg !== -1 && index >= row * EASY.cols && index < (row + 1) * EASY.cols ? [index] : [],
    );
  const withFlips = (indexes: readonly number[], count: number): ToggleDropState => ({
    ...AFTER_ONE,
    flips: AFTER_ONE.flips.map((_, index) => (indexes.includes(index) ? count : 0)),
  });

  it.each([
    [
      'a switch flipped more often than balls were dropped',
      withFlips(switchesOfRow(0).slice(0, 1), 2),
    ],
    ['a peg row flipped more often than balls were dropped', withFlips(switchesOfRow(0), 1)],
  ])('refuses %s', (_name, json) => {
    expect(parseState(throughJson(json))).toBeNull();
  });

  /** A 5 x 4 board of the second tuning row (three cups), keeping only its first `count` cups. */
  const MEDIUM = create(1, 25);
  const keepCups = (count: number): ToggleDropState => {
    const cups = MEDIUM.needs.flatMap((need, col) => (need > 0 ? [col] : [])).slice(0, count);
    return { ...MEDIUM, needs: MEDIUM.needs.map((need, col) => (cups.includes(col) ? need : 0)) };
  };

  it('refuses a board with fewer cups than its row and more than the fallback layout', () => {
    expect(MEDIUM.needs.filter((need) => need > 0)).toHaveLength(3);
    expect(parseState(throughJson(keepCups(2)))).toBeNull();
  });

  it('reads back a board of the fallback layout, which keeps only the opening cup', () => {
    expect(parseState(throughJson(keepCups(1)))).toStrictEqual(keepCups(1));
  });

  it('reads a run back after its drops, with its counts adding up', () => {
    const played = applyMove(EASY, { kind: 'drop', col: 0 }).state;
    expect(parseState(throughJson(played))).toStrictEqual(played);
  });
});

describe('parseState with the tutorial run', () => {
  const { tutorial } = TOGGLE_DROP_TEACHING;
  const scripted = tutorial.steps.flatMap((step) =>
    step.expect.kind === 'move' ? [step.expect.move] : [],
  );

  // Spec S13 and 8.6: a tutorial interrupted by a kill comes back where it was, like any run.
  it('reads back the tutorial board and every state its scripted drops reach', () => {
    const reached = scripted.reduce(
      (line, move) => [...line, applyMove(line.at(-1) ?? tutorial.start, move).state],
      [tutorial.start],
    );
    expect(reached).toHaveLength(4);
    expect(reached.map((state) => parseState(throughJson(state)))).toStrictEqual(reached);
  });
});

describe('parseMove', () => {
  it('returns every legal move unchanged after a JSON round trip (property)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const moves = listMoves(create(seed, difficulty));
        expect(moves.map((move) => parseMove(throughJson(move)))).toStrictEqual(moves);
      }),
    );
  });

  it.each([
    ['null', null],
    ['another kind', { kind: 'flip', col: 1 }],
    ['a negative column', { kind: 'drop', col: -1 }],
    ['a column no board has', { kind: 'drop', col: 12 }],
    ['a fractional column', { kind: 'drop', col: 1.5 }],
    ['an extra field', { kind: 'drop', col: 1, row: 0 }],
  ])('refuses %s', (_name, json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('TOGGLE_DROP_PERSISTENCE', () => {
  it('rebuilds the same state by replaying the saved move line', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const start = create(seed, difficulty);
        const played = playChoices(RULES, start, choices);
        const saved = throughJson(playedMoves(start, choices));
        const line = Array.isArray(saved) ? saved.map(parseMove) : [];
        const replayed = line.reduce(
          (state, move) => (move === null ? state : applyMove(state, move).state),
          start,
        );
        expect(replayed).toStrictEqual(played.states.at(-1));
      }),
    );
  });

  it('drops a run saved in an older state version (version 1 has nothing to migrate)', () => {
    expect(TOGGLE_DROP_PERSISTENCE.migrateState(create(1, 0), 0)).toBeNull();
    expect(TOGGLE_DROP_PERSISTENCE.stateVersion).toBe(1);
  });

  it('saves after every move (a turn-based game)', () => {
    expect(TOGGLE_DROP_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
  });
});
