// test/integration/game-host/__GAME_ID__-debug-controls.test.ts
// The E2E debug controls on the real game module: action=win-level and action=lose-level end any
// active run (level 1, today's daily, an endless run) through the host's one run-end path with the
// game's own win and lose examples (stars, the daily result and streak, the endless best and the
// statistics saved before Result shows), and the example screens open its example states.
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

  it("ends today's daily run like a real one: result and streak saved first (flow 11-daily)", () => {
    const { host, save } = hostFor();
    const today = TEST_CLOCK.today();
    const hasDaily = game.levels.daily.kind === 'daily';
    host.openSession({ start: 'new', ref: { kind: 'daily', date: today } });
    // A game without a daily opens nothing, and action= then reports that no run is open.
    expect(host.debugControls().playTo('won')).toBe(hasDaily);
    expect(save.doc().daily.streak).toStrictEqual({
      lastDate: hasDaily ? today : null,
      length: hasDaily ? 1 : 0,
    });
  });

  it('ends an endless run lost, its best saved before Result shows (flow 13-endless)', () => {
    const { host, save } = hostFor();
    const hasEndless = game.levels.endless.kind === 'endless';
    const opened = host.openSession({ start: 'new', ref: { kind: 'endless' } });
    expect(host.debugControls().playTo('lost')).toBe(hasEndless);
    opened?.handle.send({ type: 'finish' }); // the offered continue declined (Try again)
    const view = opened?.handle.getView();
    expect(view?.status ?? 'no endless mode').toBe(hasEndless ? 'lost' : 'no endless mode');
    expect(save.doc().progress.endlessBest).toBe(view?.summary?.score ?? 0);
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
