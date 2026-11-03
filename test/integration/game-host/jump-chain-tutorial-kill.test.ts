// test/integration/game-host/jump-chain-tutorial-kill.test.ts
// Spec S13, 8.6 and N10: the first-launch tutorial is saved after every move like any run, so a
// kill during it brings it back where it was. The Shell's boot check reads the saved run with the
// game's own parseState and drops a run it cannot read; the tutorial must never be such a run.
import { jumpChainGame as game } from '@e07/jump-chain/index.ts';
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';

/** A launch of the app over `save`: the host checks the saved run at boot, as the Shell does. */
function launch(save: SaveService) {
  const recorded: string[] = [];
  const host = createGameHost(game, {
    save,
    clock: TEST_CLOCK,
    errorLog: {
      record: (_source, error) => {
        recorded.push(error instanceof Error ? error.message : String(error));
      },
      entries: () => [],
    },
    isContinueAllowed: game.rules.continueRun.kind === 'once',
    createBoardHost: () => () => null,
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
    writeRunEnd: (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
  });
  return { host, recorded };
}

describe('a Jump Chain tutorial run interrupted by a kill', () => {
  it('comes back at its start, paused, with nothing dropped', () => {
    const { save } = createTestSave();
    expect(
      launch(save).host.openSession({ start: 'new', ref: { kind: 'tutorial' } }),
    ).not.toBeNull();
    const relaunch = launch(save);
    expect(relaunch.recorded).toStrictEqual([]);
    expect(save.doc().run?.ref).toStrictEqual({ kind: 'tutorial' });
    expect(relaunch.host.openSession({ start: 'resume' })?.handle.getView().status).toBe('paused');
  });

  it('comes back after each scripted move, where it was', () => {
    const { save } = createTestSave();
    const opened = launch(save).host.openSession({ start: 'new', ref: { kind: 'tutorial' } });
    for (const step of game.teaching.tutorial.steps.slice(0, -1)) {
      if (step.pointer.kind !== 'drag') throw new Error('every Jump Chain step drags');
      const { from, to } = step.pointer;
      opened?.handle.send({ type: 'intent', intent: { kind: 'drag-end', from, to } });
      const before = save.doc().run?.state;
      const relaunch = launch(save);
      expect(relaunch.recorded).toStrictEqual([]);
      expect(save.doc().run?.state).toStrictEqual(before);
    }
  });
});
