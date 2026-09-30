// packages/shell/src/screens/first-run/tutorial-coach.test.ts
import { tutorialCoachOf } from './tutorial-coach.ts';

import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { TutorialCoachStep } from '@e07/shell/game-host/tutorial-script.ts';

const CORNER = { regionId: 'board', col: 0, row: 0 };
const SLOT = { regionId: 'tray', col: 1, row: 0 };
const STEPS: readonly TutorialCoachStep[] = [
  { messageId: 'probe.tutorial.step-1', pointer: { kind: 'target', target: CORNER } },
  { messageId: 'probe.tutorial.step-2', pointer: { kind: 'drag', from: SLOT, to: CORNER } },
];

function viewAt(moveCount: number, status: SessionView['status'] = 'playing'): SessionView {
  return {
    status,
    ref: { kind: 'tutorial' },
    hud: {
      mode: { kind: 'tutorial' },
      goal: { kind: 'game', message: { id: 'probe.goal', values: {} } },
      score: 0,
    },
    moveCount,
    isUndoSupported: true,
    canUndo: moveCount > 0,
    isHintSupported: false,
    isHintShown: false,
    continueState: 'none',
    loseReasonKey: null,
    summary: null,
    eventSeq: moveCount,
  };
}

describe('tutorialCoachOf', () => {
  it('shows the first step with its pointer and no Skip before the second step', () => {
    expect(tutorialCoachOf(STEPS, viewAt(0))).toStrictEqual({
      stage: 'step',
      stepIndex: 0,
      messageId: 'probe.tutorial.step-1',
      targets: [CORNER],
      isSkipShown: false,
    });
  });

  it('moves one step per applied move and offers Skip from the second step', () => {
    const coach = tutorialCoachOf(STEPS, viewAt(1));
    expect([coach.stepIndex, coach.messageId, coach.isSkipShown]).toStrictEqual([
      1,
      'probe.tutorial.step-2',
      true,
    ]);
    expect(coach.targets).toStrictEqual([SLOT, CORNER]);
  });

  it('hides the sentence and pointer while paused, keeping Skip', () => {
    const coach = tutorialCoachOf(STEPS, viewAt(1, 'paused'));
    expect([coach.stage, coach.messageId, coach.targets, coach.isSkipShown]).toStrictEqual([
      'paused',
      null,
      [],
      true,
    ]);
  });

  it('is done after the last scripted move, when the run ends, and when no run opened', () => {
    expect(tutorialCoachOf(STEPS, viewAt(2)).stage).toBe('done');
    expect(tutorialCoachOf(STEPS, viewAt(1, 'won')).stage).toBe('done');
    expect(tutorialCoachOf(STEPS, viewAt(0, 'lost')).isSkipShown).toBe(false);
    expect(tutorialCoachOf(STEPS, null)).toMatchObject({ stage: 'done', stepIndex: 0 });
  });
});
