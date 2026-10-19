// apps/toggle-drop/src/testing/toggle-drop-bot.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';

import { scoreOfToggleDrop, tagToggleDropEvent, toggleDropBot } from './toggle-drop-bot.ts';

import type { ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

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

describe('scoreOfToggleDrop', () => {
  it('reports the balls left over on a win, and 0 before', () => {
    expect(scoreOfToggleDrop(board({ filled: [1, 1, 0], ballsLeft: 2 }))).toBe(2);
    expect(scoreOfToggleDrop(board())).toBe(0);
  });
});

describe('tagToggleDropEvent', () => {
  // Kill test (design notes): payoff = a cup fills; twist = a switch an earlier ball flipped sends a
  // later ball into a cup.
  it('tags a filled cup as the payoff and a redirected ball in a cup as the twist', () => {
    expect(tagToggleDropEvent({ kind: 'cup-filled', col: 1, atMs: 500 })).toStrictEqual(['payoff']);
    const landed = { kind: 'ball-landed', col: 1, x: 180, y: 360, atMs: 500 } as const;
    expect(tagToggleDropEvent({ ...landed, isInCup: true, wasRedirected: true })).toStrictEqual([
      'twist',
    ]);
    expect(tagToggleDropEvent({ ...landed, isInCup: true, wasRedirected: false })).toStrictEqual(
      [],
    );
    expect(tagToggleDropEvent({ ...landed, isInCup: false, wasRedirected: true })).toStrictEqual(
      [],
    );
    expect(
      tagToggleDropEvent({
        kind: 'switch-flipped',
        col: 1,
        row: 0,
        side: 0,
        x: 180,
        y: 120,
        atMs: 167,
      }),
    ).toStrictEqual([]);
  });
});

describe('toggleDropBot', () => {
  it('takes a drop that fills the last cup', () => {
    const state = board({ filled: [1, 0, 0], ballsLeft: 1 });
    const choice = toggleDropBot(state, listMoves(state), seedRng(1));
    expect([1, 2]).toContain(choice.move.col);
  });

  it('plays only listed moves on a real level', () => {
    const start = create(7, 40);
    const moves = listMoves(start);
    expect(moves).toContainEqual(toggleDropBot(start, moves, seedRng(7)).move);
  });
});
