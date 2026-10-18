// packages/shell/src/game-host/tutorial-script.test.ts
import {
  coachStepsOf,
  expectsScriptedMove,
  exampleHighlightOf,
  howToPlayPagesOf,
  isSameMove,
  isTutorialMoveAccepted,
  pointerTargets,
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

describe('pointerTargets and exampleHighlightOf', () => {
  const CORNER = { regionId: 'board', col: 0, row: 0 };
  const SLOT = { regionId: 'tray', col: 1, row: 0 };

  it('names the target, both ends of a drag, and no cell for the top bar or no pointer', () => {
    expect(pointerTargets({ kind: 'target', target: CORNER })).toStrictEqual([CORNER]);
    expect(pointerTargets({ kind: 'drag', from: SLOT, to: CORNER })).toStrictEqual([SLOT, CORNER]);
    expect(pointerTargets({ kind: 'hud', element: 'undo' })).toStrictEqual([]);
    expect(pointerTargets({ kind: 'none' })).toStrictEqual([]);
  });

  it("outlines an S13 picture's pointer cells as hinted, with nothing selected", () => {
    expect(exampleHighlightOf({ kind: 'target', target: CORNER })).toStrictEqual({
      selected: null,
      hinted: [CORNER],
    });
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
