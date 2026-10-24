// packages/shell/src/game-host/tutorial-script.test.ts
import {
  coachStepsOf,
  expectsScriptedMove,
  howToPlayPagesOf,
  isSameMove,
  isTutorialTry,
  isTutorialMoveAccepted,
  tutorialRulesOf,
} from './tutorial-script.ts';

import type { TutorialStep } from '@e07/game-kit/contract/teaching.ts';

type Move = { readonly kind: 'add'; readonly amount: 1 | 2 };

const ADD_ONE: Move = { kind: 'add', amount: 1 };
const ADD_TWO: Move = { kind: 'add', amount: 2 };
const STEPS: readonly TutorialStep<Move>[] = [
  {
    messageId: 'tally.tutorial.add-two',
    pointer: { kind: 'target', target: { regionId: 'board', col: 1, row: 0 } },
    expect: { kind: 'move', move: ADD_TWO },
  },
  { messageId: 'tally.tutorial.any', pointer: { kind: 'none' }, expect: { kind: 'any-move' } },
];

describe('isTutorialMoveAccepted', () => {
  it('accepts only the expected move of a scripted step', () => {
    expect(isTutorialMoveAccepted(STEPS, ADD_TWO, 0)).toBe(true);
    expect(isTutorialMoveAccepted(STEPS, ADD_ONE, 0)).toBe(false);
  });

  it('accepts every move on an any-move step and after the last step', () => {
    expect(isTutorialMoveAccepted(STEPS, ADD_ONE, 1)).toBe(true);
    expect(isTutorialMoveAccepted(STEPS, ADD_ONE, 2)).toBe(true);
  });
});

describe('expectsScriptedMove', () => {
  it('names the steps that wait for one exact move, where a refused try earns a nudge', () => {
    expect([0, 1, 2].map((moveCount) => expectsScriptedMove(STEPS, moveCount))).toStrictEqual([
      true,
      false,
      false,
    ]);
  });
});

describe('tutorialRulesOf', () => {
  it("hands the tutorial run's controller both rules of the script", () => {
    const rules = tutorialRulesOf(STEPS);
    expect([rules.isMoveAccepted(ADD_ONE, 0), rules.isMoveAccepted(ADD_ONE, 1)]).toStrictEqual([
      false,
      true,
    ]);
    expect([rules.expectsMove(0), rules.expectsMove(1)]).toStrictEqual([true, false]);
  });
});

describe('tutorialRulesOf isTry', () => {
  it('hands the controller the refused-try rule, isTutorialTry', () => {
    expect(tutorialRulesOf(STEPS).isTry).toBe(isTutorialTry);
  });
});

describe('isSameMove', () => {
  it('compares plain-data moves by value, key order included or not', () => {
    expect(isSameMove({ kind: 'add', amount: 2 }, { amount: 2, kind: 'add' })).toBe(true);
    expect(isSameMove({ cells: [1, 2] }, { cells: [1, 2] })).toBe(true);
    expect(isSameMove({ cells: [1, 2] }, { cells: [2, 1] })).toBe(false);
    expect(isSameMove({ kind: 'add' }, { kind: 'add', amount: 1 })).toBe(false);
    expect(isSameMove([1], { 0: 1 })).toBe(false);
  });
});

describe('coachStepsOf', () => {
  it('keeps each sentence and pointer and drops the typed expected move', () => {
    expect(coachStepsOf(STEPS)).toStrictEqual([
      {
        messageId: 'tally.tutorial.add-two',
        pointer: { kind: 'target', target: { regionId: 'board', col: 1, row: 0 } },
      },
      { messageId: 'tally.tutorial.any', pointer: { kind: 'none' } },
    ]);
  });
});

describe('isTutorialTry', () => {
  const CELL = { regionId: 'board', col: 1, row: 0 };

  it('counts a wrong move and a press on a cell, never a cancelled drag, swipe or aim', () => {
    expect(isTutorialTry({ kind: 'drag-end', from: CELL, to: CELL }, ADD_TWO)).toBe(true);
    expect(isTutorialTry({ kind: 'tap', target: CELL, selected: null }, null)).toBe(true);
    expect(isTutorialTry({ kind: 'long-press', target: CELL }, null)).toBe(true);
    expect(isTutorialTry({ kind: 'drag-end', from: CELL, to: null }, null)).toBe(false);
    expect(isTutorialTry({ kind: 'drag-end', from: CELL, to: CELL }, null)).toBe(false);
    expect(isTutorialTry({ kind: 'swipe', direction: 'up', from: CELL }, null)).toBe(false);
    expect(isTutorialTry({ kind: 'aim', dx: 1, dy: 0 }, null)).toBe(false);
  });
});

describe('howToPlayPagesOf', () => {
  it("keeps each page's goal and step keys and drops its typed example state", () => {
    const pages = [
      {
        titleId: 'probe.goal',
        bodyId: 'probe.step-1',
        example: { count: 1 },
        pointer: { kind: 'none' },
      },
    ] as const;
    expect(howToPlayPagesOf(pages)).toStrictEqual([
      { titleId: 'probe.goal', bodyId: 'probe.step-1' },
    ]);
  });
});
