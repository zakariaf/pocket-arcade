// packages/shell/src/game-host/tutorial-refusals.test.ts
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createGameHost } from './game-host.ts';

import type { GameHost } from './game-host.ts';

/** The tally game's tutorial: step 1 expects column 0 (add one), step 2 column 1 (add two). */
const tap = (col: number) =>
  ({
    type: 'intent',
    intent: { kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null },
  }) as const;

function hostFor(): GameHost {
  const { save } = createTestSave();
  return createGameHost(TALLY_GAME, {
    save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    writeRunEnd: (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  });
}

describe('the tutorial run and the tries its script refuses', () => {
  it('counts what a scripted step refuses, so the coach can nudge, until the step is played', () => {
    // Spec S13 is silent on a refused tutorial move; the default (CLAUDE.md product rule): never a
    // silent no-op. The view counts the refusals of the step on screen, and the coach nudges.
    const opened = hostFor().openSession({
      start: 'new',
      ref: { kind: 'tutorial' },
    });
    if (opened === null) throw new Error('no tutorial');
    expect(opened.handle.getView().refusedMoves).toBeUndefined();
    opened.handle.send(tap(1));
    const longPress = {
      kind: 'long-press',
      target: { regionId: 'board', col: 0, row: 0 },
    } as const;
    opened.handle.send({ type: 'intent', intent: longPress });
    expect(opened.handle.getView().refusedMoves).toBe(2);
    opened.handle.send(tap(0));
    expect(opened.handle.getView().refusedMoves).toBeUndefined();
    opened.handle.send(tap(0));
    expect(opened.handle.getView().refusedMoves).toBe(1);
  });

  it('counts no refusal while the tutorial is paused, nor in any other run', () => {
    const host = hostFor();
    const tutorial = host.openSession({ start: 'new', ref: { kind: 'tutorial' } });
    if (tutorial === null) throw new Error('no tutorial');
    tutorial.handle.send({ type: 'pause' });
    tutorial.handle.send(tap(1));
    expect(tutorial.handle.getView().refusedMoves).toBeUndefined();
    const level = host.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
    if (level === null) throw new Error('no level');
    level.handle.send({ type: 'intent', intent: { kind: 'aim', dx: 1, dy: 0 } });
    expect(level.handle.getView().refusedMoves).toBeUndefined();
  });
});
