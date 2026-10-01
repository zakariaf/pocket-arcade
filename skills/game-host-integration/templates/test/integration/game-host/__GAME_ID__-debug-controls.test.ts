// test/integration/game-host/__GAME_ID__-debug-controls.test.ts
// The E2E debug controls on the real game module: action=win-level and action=lose-level end any
// active run (level 1, today's daily, an endless run) through the host's one run-end path with the
// game's own win and lose examples (stars, the daily result and streak, the endless best and the
// statistics saved before Result shows), and the example screens open its example states. A loss
// nobody can rescue (L11: the continue offer is hidden) ends at once through the finish the Game
// screen model sends, so its recorded Result shows: the endless result with New best, or the lose
// result counted once in the statistics.
import { __GAME_CAMEL__Game as game } from '@e07/__GAME_ID__/index.ts';
import { EXAMPLE_RUN } from '@e07/shell/game-host/game-debug-controls.ts';
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { resultModelOf } from '@e07/shell/game-host/result-model-of.ts';
import { isLossStranded } from '@e07/shell/game-host/run-end-policy.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import type { SessionHandle, SessionView } from '@e07/shell/game-host/session-view.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;

/** What S7 shows for the view after the run end, with no continue to offer. */
function resultFor(view: SessionView, endlessBest: number) {
  return resultModelOf({
    view,
    game: { winTitleId: game.identity.winTitleId, logo: game.presentation.art.logo },
    text: { t: (key) => key, formatNumber: String, gameText: (message) => message.id },
    actions: {
      onNext: jest.fn(),
      onReplay: jest.fn(),
      onLevels: jest.fn(),
      onTryAgain: jest.fn(),
      onHome: jest.fn(),
      onContinue: jest.fn(),
      onOpenPremium: jest.fn(),
    },
    continueOffer: 'hidden',
    isReducedMotion: false,
    extras: { streakDays: 0, endlessBest, nudgePriceText: null },
  });
}

/** use-game-screen-model's L11 step: finish a loss whose continue offer is hidden. */
function finishIfStranded(handle: SessionHandle | undefined): void {
  if (handle !== undefined && isLossStranded(handle.getView(), 'hidden')) {
    handle.send({ type: 'finish' });
  }
}

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

  it('ends an endless loss nobody can rescue at once: best saved, endless result (L11)', () => {
    const { host, save } = hostFor();
    const hasEndless = game.levels.endless.kind === 'endless';
    const opened = host.openSession({ start: 'new', ref: { kind: 'endless' } });
    expect(host.debugControls().playTo('lost')).toBe(hasEndless);
    finishIfStranded(opened?.handle);
    const view = opened?.handle.getView();
    if (!hasEndless || view === undefined) return; // a game without endless opens nothing
    expect(view.summary).toMatchObject({ isWon: false, isNewBest: view.summary?.score !== 0 });
    expect(save.doc().progress.endlessBest).toBe(view.summary?.score);
    expect(resultFor(view, save.doc().progress.endlessBest)).toMatchObject({
      kind: 'endless',
      isNewBest: view.summary?.isNewBest,
    });
  });

  it('counts a lost level once and shows the lose result without an offer (L11)', () => {
    const { host, save } = hostFor();
    const opened = host.openSession({ start: 'new', ref: LEVEL_1 });
    expect(host.debugControls().playTo('lost')).toBe(true);
    finishIfStranded(opened?.handle);
    finishIfStranded(opened?.handle);
    expect(save.doc().stats.losses).toBe(1);
    const view = opened?.handle.getView();
    expect(view === undefined ? null : resultFor(view, 0)).toMatchObject({
      kind: 'lose',
      continueOffer: null,
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
