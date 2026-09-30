// test/integration/game-host/__GAME_ID__-debug-controls.test.ts
// The E2E debug controls on the real game module: action=win-level and action=lose-level end
// level 1 through the host's one run-end path with the game's own win and lose examples (stars
// and statistics saved before Result shows), and the example screens open its example states.
import { __GAME_CAMEL__Game as game } from '@e07/__GAME_ID__/index.ts';
import { EXAMPLE_RUN } from '@e07/shell/game-host/game-debug-controls.ts';
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;

function hostFor() {
  const { save } = createTestSave();
  const host = createGameHost(game, {
    save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: game.rules.continueRun.kind === 'once',
    createBoardHost: () => () => null,
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
    writeRunEnd: (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
  });
  return { host, save };
}

describe('the __GAME_ID__ debug controls', () => {
  it('ends level 1 as won with its stars saved before Result shows (action=win-level)', () => {
    const { host, save } = hostFor();
    const opened = host.openSession({ start: 'new', ref: LEVEL_1 });
    expect(host.debugControls().playTo('won')).toBe(true);
    expect(save.doc().progress.levels['1']?.stars).toBeGreaterThanOrEqual(1);
    expect(opened?.handle.getView()).toMatchObject({ status: 'won', summary: { isWon: true } });
  });

  it('loses level 1 with the game lose reason (action=lose-level)', () => {
    const { host } = hostFor();
    const opened = host.openSession({ start: 'new', ref: LEVEL_1 });
    expect(host.debugControls().playTo('lost')).toBe(true);
    const lost = game.engine.outcome(game.testing.examples.lose());
    expect(opened?.handle.getView()).toMatchObject({
      status: 'lost',
      loseReasonKey: lost.kind === 'lost' ? lost.reasonKey : null,
    });
  });

  it('opens level 1 at the start and middle examples (screen=game-start, game-middle)', () => {
    const { host, save } = hostFor();
    for (const [example, state] of [
      ['game-start', game.testing.examples.start()],
      ['game-middle', game.testing.examples.middle()],
    ] as const) {
      host.debugControls().openExample(example);
      const view = host.openSession(EXAMPLE_RUN)?.handle.getView();
      expect(view).toMatchObject({ status: 'playing', ref: LEVEL_1 });
      expect(save.doc().run?.state).toStrictEqual(state);
    }
  });
});
