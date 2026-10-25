// apps/toggle-drop/src/rules/toggle-drop-evaluate.test.ts
import { evaluateToggleDrop, openShots } from './toggle-drop-evaluate.ts';

import type { ToggleDropState } from './toggle-drop-types.ts';

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

describe('openShots', () => {
  it('counts the columns whose next ball would land in a cup that needs it', () => {
    expect(openShots(board())).toBe(3);
    expect(openShots(board({ filled: [1, 0, 0] }))).toBe(2);
    expect(openShots(board({ filled: [0, 1, 0] }))).toBe(1);
  });

  it('counts no shot into a column it has no cup counts for (a damaged board)', () => {
    expect(openShots(board({ needs: [], filled: [] }))).toBe(0);
  });
});

describe('evaluateToggleDrop', () => {
  it('ranks a win above every board and a loss below', () => {
    const playing = board();
    const won = board({ filled: [1, 1, 0], ballsLeft: 1 });
    const lost = board({ filled: [1, 0, 0], ballsLeft: 0 });
    expect(evaluateToggleDrop(won)).toBeGreaterThan(evaluateToggleDrop(playing));
    expect(evaluateToggleDrop(lost)).toBeLessThan(evaluateToggleDrop(playing));
  });

  it('prefers a win with more balls left over', () => {
    const late = board({ filled: [1, 1, 0], ballsLeft: 0 });
    const early = board({ filled: [1, 1, 0], ballsLeft: 2 });
    expect(evaluateToggleDrop(early)).toBeGreaterThan(evaluateToggleDrop(late));
  });

  it('values a ball in a cup above any number of open shots', () => {
    expect(evaluateToggleDrop(board({ filled: [0, 1, 0] }))).toBeGreaterThan(
      evaluateToggleDrop(board()),
    );
  });

  it('prefers the board that leaves more columns landing in a needy cup', () => {
    const open = board({ filled: [1, 0, 0] });
    const narrow = board({ filled: [0, 1, 0] });
    expect(evaluateToggleDrop(open)).toBeGreaterThan(evaluateToggleDrop(narrow));
  });
});
