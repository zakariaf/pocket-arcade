// apps/merge-siege/src/rules/list-moves.test.ts
// Spec 10 RULES: "The list of moves allowed in a state." A Merge Siege move is a 4-way swipe
// (design notes, input: engine.panMode 'swipe'); it is legal when it changes the board.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { parseBoard } from './board-text.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';

const EMPTY = ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .'];

function stateWith(
  rows: readonly string[],
  overrides: Partial<MergeSiegeState> = {},
): MergeSiegeState {
  return { ...create(1, 0), cells: parseBoard(rows), ...overrides };
}

const directions = (state: MergeSiegeState): string[] =>
  listMoves(state).map((move) => move.direction);

describe('listMoves (a 4-way swipe)', () => {
  it('lists every swipe that slides a tile, once each, in the order up, down, left, right', () => {
    const state = stateWith([
      'e2 . . . .',
      '. . . . .',
      '. . . . .',
      '. . 2 . .',
      '. . . . .',
      '. . . . .',
    ]);
    expect(listMoves(state)).toStrictEqual([
      { kind: 'swipe', direction: 'up' },
      { kind: 'swipe', direction: 'down' },
      { kind: 'swipe', direction: 'left' },
      { kind: 'swipe', direction: 'right' },
    ]);
  });

  it('leaves out a swipe that moves nothing', () => {
    expect(directions(stateWith(['e2 . . . .', ...EMPTY.slice(1), '2 . . . .']))).toStrictEqual([
      'up',
      'right',
    ]);
  });

  it('lists a swipe that only merges two tiles', () => {
    expect(directions(stateWith(['e2 . . . .', ...EMPTY.slice(1), '2 2 8 16 32']))).toStrictEqual([
      'up',
      'left',
      'right',
    ]);
  });

  it('lists a swipe whose only effect is a tile smashing the enemy next to it', () => {
    expect(
      directions(stateWith(['e2 . . . .', ...EMPTY.slice(2), '8 e4 16 32 64', '. . . . .'])),
    ).toContain('right');
  });

  it('lists a swipe whose only effect is a tile lost to the bigger enemy next to it', () => {
    expect(
      directions(stateWith(['e2 . . . .', ...EMPTY.slice(2), '2 e8 16 32 64', '. . . . .'])),
    ).toContain('right');
  });

  it('lists nothing once the enemies have overrun the board', () => {
    expect(
      listMoves(stateWith([...EMPTY.slice(0, 2), '. 2 . . .', ...EMPTY.slice(3), '. . e4 . .'])),
    ).toStrictEqual([]);
  });

  it('lists nothing once the level is won', () => {
    expect(
      listMoves(stateWith([...EMPTY.slice(0, 2), '. 2 . . .', ...EMPTY.slice(2)], { next: null })),
    ).toStrictEqual([]);
  });

  describe('properties', () => {
    it('lists each swipe at most once, and none exactly when the run is over', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.integer({ min: 0, max: 100 }),
          fc.array(fc.nat(), { maxLength: 40 }),
          (seed, difficulty, choices) => {
            const { states } = playChoices(
              { listMoves, applyMove },
              create(seed, difficulty),
              choices,
            );
            for (const state of states) expectListedOnceUntilOver(state);
          },
        ),
      );
    });
  });
});

function expectListedOnceUntilOver(state: MergeSiegeState): void {
  const listed = directions(state);
  expect(new Set(listed).size).toBe(listed.length);
  expect(listed.length === 0).toBe(outcome(state).kind !== 'playing');
}
