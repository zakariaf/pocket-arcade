// packages/shell/src/game-host/stranded-loss.test.ts
// L11 on the tally game: a lost run whose continue nobody can give (offer 'hidden': ads off,
// offline, no rewarded ad that can come, no Premium) is ended by the finish the Game screen model
// sends (isLossStranded), so the run end is saved first and the recorded Result shows at once.
import { recordLevelEnd } from '@e07/shell/services/ads/ad-history.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createGameHost } from './game-host.ts';
import { resultModelOf } from './result-model-of.ts';
import { isLossStranded } from './run-end-policy.ts';

import type { GameHost, GameHostDeps } from './game-host.ts';
import type { ResultInput } from './result-model-of.ts';
import type { SessionHandle, SessionView } from './session-view.ts';
import type { RunRef, SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { TestSave } from '@e07/shell/testing/create-test-save.ts';

const tap = (col: number) =>
  ({
    type: 'intent',
    intent: { kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null },
  }) as const;

/** The composition root's ad part of the run end (recordAdLevelEnd), counted per update. */
function hostFor(test: TestSave): { readonly host: GameHost; readonly updates: string[] } {
  const updates: string[] = [];
  const deps: GameHostDeps = {
    save: test.save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
    extendRunEnd: (doc: SaveDoc, summary) => {
      updates.push(summary.ref.kind);
      if (summary.ref.kind !== 'level') return doc;
      const history = recordLevelEnd(doc.ads.history, summary.isWon ? 'win' : 'lose');
      return { ...doc, ads: { ...doc.ads, history } };
    },
    writeRunEnd: (write) => {
      test.save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
  };
  return { host: createGameHost(TALLY_GAME, deps), updates };
}

function openRun(host: GameHost, ref: RunRef): SessionHandle {
  const opened = host.openSession({ start: 'new', ref });
  if (opened === null) throw new Error('session did not open');
  return opened.handle;
}

/** What use-game-screen-model does once per eventSeq: finish a loss nobody can rescue. */
function finishIfStranded(handle: SessionHandle): void {
  if (isLossStranded(handle.getView(), 'hidden')) handle.send({ type: 'finish' });
}

function resultOf(view: SessionView, endlessBest: number) {
  const input: ResultInput = {
    view,
    game: { winTitleId: 'tally.win-title', logo: { layers: [] } },
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
  };
  return resultModelOf(input);
}

describe('a loss nobody can rescue (L11)', () => {
  it('ends an endless run at once: best saved, then the endless result with New best', () => {
    const test = createTestSave();
    const { host } = hostFor(test);
    const handle = openRun(host, { kind: 'endless' });
    for (const col of [1, 1, 1, 1, 0, 1]) handle.send(tap(col)); // 11 > 10: overshot
    expect(handle.getView()).toMatchObject({ status: 'lost', continueState: 'offered' });
    expect(isLossStranded(handle.getView(), 'hidden')).toBe(true);

    finishIfStranded(handle);

    const view = handle.getView();
    expect(view.summary).toMatchObject({ isWon: false, isNewBest: true });
    const best = test.readSlot('current').progress.endlessBest;
    expect(best).toBe(view.summary?.score);
    expect(resultOf(view, best)).toMatchObject({ kind: 'endless', isNewBest: true });
    expect(test.readSlot('current').run).toBeNull();
  });

  it('counts a lost level once, with its ad history, before the lose result shows', () => {
    const test = createTestSave();
    const { host, updates } = hostFor(test);
    const handle = openRun(host, { kind: 'level', level: 1 });
    for (const col of [1, 0, 1]) handle.send(tap(col)); // 5 > 4
    finishIfStranded(handle);
    finishIfStranded(handle); // the model runs again on the next render: nothing more is recorded
    handle.send({ type: 'finish' });

    expect(test.readSlot('backup').stats.losses).toBe(1);
    expect(updates).toStrictEqual(['level']);
    expect(resultOf(handle.getView(), 0)).toMatchObject({ kind: 'lose', continueOffer: null });
  });

  it("saves today's daily result and streak before the Result", () => {
    const test = createTestSave();
    const { host } = hostFor(test);
    const today = TEST_CLOCK.today();
    const handle = openRun(host, { kind: 'daily', date: today });
    for (const col of [1, 1, 1]) handle.send(tap(col)); // 6 > 5
    finishIfStranded(handle);

    const daily = test.readSlot('backup').daily;
    expect(daily.results[today]).toMatchObject({ won: false });
    expect(daily.streak).toStrictEqual({ lastDate: today, length: 1 });
    expect(resultOf(handle.getView(), 0)).toMatchObject({ kind: 'daily' });
  });

  it('ends a pending lost run reopened from Home the same way', () => {
    const test = createTestSave();
    const first = openRun(hostFor(test).host, { kind: 'endless' });
    for (const col of [1, 1, 1, 1, 0, 1]) first.send(tap(col));
    // The app was killed while the offer was still loading: the lost run waits in the save.
    expect(test.readSlot('current').run).not.toBeNull();

    const reopened = hostFor(test).host.openSession({ start: 'resume' });
    if (reopened === null) throw new Error('the pending loss was not reopened');
    expect(isLossStranded(reopened.handle.getView(), 'hidden')).toBe(true);
    finishIfStranded(reopened.handle);

    expect(reopened.handle.getView().summary).toMatchObject({ isWon: false });
    expect(test.readSlot('current').run).toBeNull();
  });

  it('keeps the loss open while the player can still continue', () => {
    const test = createTestSave();
    const handle = openRun(hostFor(test).host, { kind: 'endless' });
    for (const col of [1, 1, 1, 1, 0, 1]) handle.send(tap(col));
    for (const offer of ['loading', 'watch-ad', 'free'] as const) {
      expect(isLossStranded(handle.getView(), offer)).toBe(false);
    }
    expect(handle.getView().summary).toBeNull();
  });
});
