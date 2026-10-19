// apps/toggle-drop/src/rules/apply-move.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

import type { ToggleDropState } from './toggle-drop-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 12 });

/** Row 0: a right switch in the middle; row 1: left switches at both ends; cups under 0 and 1. */
function board(overrides: Partial<ToggleDropState> = {}): ToggleDropState {
  return {
    cols: 3,
    rows: 2,
    pegs: [-1, 1, -1, 0, -1, 0],
    flips: [0, 0, 0, 0, 0, 0],
    needs: [1, 1, 0],
    filled: [0, 0, 0],
    ballsLeft: 3,
    drops: 0,
    ...overrides,
  };
}

const DROP_1 = { kind: 'drop', col: 1 } as const;

/** What applyMove does with a drop in this column: applies it, or throws which error. */
function dropAnswer(
  state: ToggleDropState,
  col: number,
): 'applied' | 'range-error' | 'other-error' {
  try {
    applyMove(state, { kind: 'drop', col });
    return 'applied';
  } catch (error) {
    return error instanceof RangeError ? 'range-error' : 'other-error';
  }
}

/** Problems of a played line: a changed input, a ball count off by more than one, an overfilled cup. */
function stepProblems(states: readonly ToggleDropState[]): string[] {
  const problems: string[] = [];
  for (let index = 1; index < states.length; index += 1) {
    const before = states[index - 1];
    const after = states[index];
    if (before === undefined || after === undefined) continue;
    const frozen = JSON.stringify(before);
    const move = listMoves(before)[0];
    if (move !== undefined) applyMove(before, move);
    if (JSON.stringify(before) !== frozen) problems.push(`input changed at ${String(index)}`);
    if (after.ballsLeft !== before.ballsLeft - 1) problems.push(`balls off at ${String(index)}`);
    if (after.filled.some((count, col) => count > (after.needs[col] ?? 0))) {
      problems.push(`overfilled at ${String(index)}`);
    }
  }
  return problems;
}

describe('applyMove', () => {
  // Catalogue: "every switch it passes sends it left or right and flips".
  it('drops the ball through the switches, flips each one it passes and fills the cup it lands in', () => {
    const { state, events } = applyMove(board(), DROP_1);
    expect(events).toStrictEqual([
      { kind: 'ball-dropped', col: 1, x: 180, y: 0, atMs: 0 },
      { kind: 'switch-flipped', col: 1, row: 0, side: 0, x: 180, y: 120, atMs: 167 },
      { kind: 'switch-flipped', col: 2, row: 1, side: 1, x: 300, y: 240, atMs: 333 },
      {
        kind: 'ball-landed',
        col: 1,
        x: 180,
        y: 360,
        isInCup: true,
        wasRedirected: false,
        atMs: 500,
      },
      { kind: 'cup-filled', col: 1, atMs: 500 },
    ]);
    expect(state).toStrictEqual(
      board({
        pegs: [-1, 0, -1, 0, -1, 1],
        flips: [0, 1, 0, 0, 0, 1],
        filled: [0, 1, 0],
        ballsLeft: 2,
        drops: 1,
      }),
    );
  });

  it('sends a later ball the other way through a switch an earlier ball flipped (the twist)', () => {
    const second = applyMove(applyMove(board(), DROP_1).state, DROP_1);
    expect(second.events.filter((event) => event.kind === 'ball-landed')).toStrictEqual([
      { kind: 'ball-landed', col: 0, x: 60, y: 360, isInCup: true, wasRedirected: true, atMs: 500 },
    ]);
    expect(second.state.filled).toStrictEqual([1, 1, 0]);
  });

  it('passes a row without a switch, and loses a ball that lands in the gutter', () => {
    const { state, events } = applyMove(board({ needs: [1, 0, 0] }), { kind: 'drop', col: 2 });
    expect(events.slice(0, 2)).toStrictEqual([
      { kind: 'ball-dropped', col: 2, x: 300, y: 0, atMs: 0 },
      { kind: 'ball-passed', col: 2, row: 0, x: 300, y: 120, atMs: 167 },
    ]);
    expect(events.at(-1)).toStrictEqual({
      kind: 'ball-landed',
      col: 1,
      x: 180,
      y: 360,
      isInCup: false,
      wasRedirected: false,
      atMs: 500,
    });
    expect(state.filled).toStrictEqual([0, 0, 0]);
    expect(state.ballsLeft).toBe(2);
  });

  it('loses a ball that lands in a cup that is already full', () => {
    const { state, events } = applyMove(board({ filled: [0, 1, 0] }), { kind: 'drop', col: 2 });
    expect(events.at(-1)).toMatchObject({ kind: 'ball-landed', col: 1, isInCup: false });
    expect(state.filled).toStrictEqual([0, 1, 0]);
  });

  describe('when the move is illegal', () => {
    it('throws for a column outside the board', () => {
      expect(() => applyMove(board(), { kind: 'drop', col: 3 })).toThrow(RangeError);
    });

    it('throws once the balls are spent', () => {
      expect(() => applyMove(board({ ballsLeft: 0 }), DROP_1)).toThrow(RangeError);
    });
  });

  it('accepts every listed move and replays identically for the same choices', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const first = playChoices(RULES, create(seed, difficulty), choices);
        expect(playChoices(RULES, create(seed, difficulty), choices)).toStrictEqual(first);
      }),
    );
  });

  it('keeps its input unchanged, spends one ball per drop and never overfills a cup', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const { states } = playChoices(RULES, create(seed, difficulty), choices);
        expect(stepProblems(states)).toStrictEqual([]);
      }),
    );
  });

  it('names every event in past-tense kebab-case and times it', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, fc.nat(), (seed, difficulty, pick) => {
        const start = create(seed, difficulty);
        const moves = listMoves(start);
        const move = moves[pick % moves.length] ?? DROP_1;
        const events = applyMove(start, move).events;
        expect(events.filter((event) => !/^[a-z]+(-[a-z]+)*ed$/.test(event.kind))).toStrictEqual(
          [],
        );
        expect(events.every((event) => Number.isInteger(event.atMs))).toBe(true);
      }),
    );
  });

  it('throws a RangeError for exactly the columns listMoves does not list', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: -3, max: 12 }), (seed, col) => {
        const start = create(seed, 30);
        const isListed = listMoves(start).some((move) => move.col === col);
        expect(dropAnswer(start, col)).toBe(isListed ? 'applied' : 'range-error');
      }),
    );
  });
});
