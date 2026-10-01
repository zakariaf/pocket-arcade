// packages/shell/src/game-host/game-debug-controls.test.ts
// The debug controls through the real createGameHost and the tally game: what action=win-level,
// action=lose-level and the example screens do to the save and the view.
import { recordLevelEnd } from '@e07/shell/services/ads/ad-history.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { EXAMPLE_RUN } from './game-debug-controls.ts';
import { createGameHost } from './game-host.ts';

import type { GameFixture } from './game-fixture.ts';
import type { GameHostDeps } from './game-host.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;
const FIXTURE: GameFixture = {
  level: 12,
  score: 1840,
  progress: { mid: { target: 3 }, full: { target: 3 } },
  stars: 3,
  isNewBest: true,
  movesCount: 7,
  par: 7,
  bestScore: 1840,
  loseReasonKey: 'tally.lose.overshot',
  isContinueOffered: true,
};

/** The ads layer's part of the run-end update, as the composition root passes it. */
function recordAdLevelEnd(doc: SaveDoc, summary: { readonly isWon: boolean }): SaveDoc {
  const history = recordLevelEnd(doc.ads.history, summary.isWon ? 'win' : 'lose');
  return { ...doc, ads: { ...doc.ads, history } };
}

function hostWith(extra: Partial<GameHostDeps> = {}) {
  const { save } = createTestSave();
  const order: string[] = [];
  const host = createGameHost(TALLY_GAME, {
    save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
    extendRunEnd: recordAdLevelEnd,
    writeRunEnd: (write) => {
      order.push('write');
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    ...extra,
  });
  return { host, save, order };
}

describe('GameHost.debugControls', () => {
  it('plays the open level to a win through the one run-end path, saved before Result shows', () => {
    const { host, save, order } = hostWith();
    const opened = host.openSession({ start: 'new', ref: LEVEL_1 });
    opened?.handle.subscribe(() => {
      order.push(`view ${opened.handle.getView().status}`);
    });
    expect(host.debugControls().playTo('won')).toBe(true);
    // Stars, statistics and the ad history are on disk before the view (and so S7) changes.
    expect(order[0]).toBe('write');
    expect(order.at(-1)).toBe('view won');
    const doc = save.doc();
    expect(doc.progress.levels['1']?.stars).toBeGreaterThanOrEqual(1);
    expect([doc.stats.gamesPlayed, doc.stats.wins]).toStrictEqual([1, 1]);
    expect(doc.ads.history.levelsCompletedSinceInterstitial).toBe(1);
    expect(doc.run).toBeNull();
    expect(opened?.handle.getView()).toMatchObject({ status: 'won', summary: { isWon: true } });
  });

  it('loses the open level with the continue on offer, as a real loss would', () => {
    const { host, save } = hostWith();
    const opened = host.openSession({ start: 'new', ref: LEVEL_1 });
    expect(host.debugControls().playTo('lost')).toBe(true);
    expect(opened?.handle.getView()).toMatchObject({
      status: 'lost',
      continueState: 'offered',
      loseReasonKey: 'tally.lose.overshot',
      summary: null,
    });
    expect(save.doc().run).not.toBeNull();
  });

  it("plays today's daily run to a win: the daily result and the streak are saved first", () => {
    const { host, save, order } = hostWith();
    const today = TEST_CLOCK.today();
    const opened = host.openSession({ start: 'new', ref: { kind: 'daily', date: today } });
    opened?.handle.subscribe(() => {
      order.push(`view ${opened.handle.getView().status}`);
    });
    expect(host.debugControls().playTo('won')).toBe(true);
    expect([order[0], order.at(-1)]).toStrictEqual(['write', 'view won']);
    const { daily, run } = save.doc();
    expect(daily.results[today]).toMatchObject({ won: true });
    expect([daily.completed, daily.streak]).toStrictEqual([1, { lastDate: today, length: 1 }]);
    expect(run).toBeNull();
    expect(opened?.handle.getView()).toMatchObject({ status: 'won', ref: { kind: 'daily' } });
  });

  it('ends an endless run lost: the endless best is saved and beats the old best (New best!)', () => {
    const { host, save } = hostWith();
    const opened = host.openSession({ start: 'new', ref: { kind: 'endless' } });
    expect(host.debugControls().playTo('lost')).toBe(true);
    opened?.handle.send({ type: 'finish' }); // Try again: the offered continue is declined
    const lostScore = TALLY_GAME.testing.examples.lose().count;
    expect(opened?.handle.getView()).toMatchObject({
      status: 'lost',
      summary: { isNewBest: true },
    });
    expect(save.doc().progress.endlessBest).toBe(lostScore);
    expect(save.doc().stats.bestScore.endless).toBe(lostScore);
  });

  it('does nothing without an open run, after the run ended and after leaving for Home', () => {
    const { host } = hostWith();
    expect(host.debugControls().playTo('won')).toBe(false);
    host.openSession({ start: 'new', ref: LEVEL_1 });
    expect(host.debugControls().playTo('won')).toBe(true);
    expect(host.debugControls().playTo('won')).toBe(false);
    const left = host.openSession({ start: 'new', ref: LEVEL_1 });
    left?.handle.send({ type: 'leave' });
    expect(host.debugControls().playTo('lost')).toBe(false);
    host.openSession({ start: 'new', ref: { kind: 'tutorial' } });
    expect(host.debugControls().playTo('won')).toBe(false);
  });

  it('opens the Game route on a level-1 run at the middle example', () => {
    const openGame = jest.fn();
    const { host, save } = hostWith({ openGame });
    host.debugControls().openExample('game-middle');
    expect(openGame).toHaveBeenCalledWith(EXAMPLE_RUN);
    const opened = host.openSession(EXAMPLE_RUN);
    expect(opened?.handle.getView()).toMatchObject({ status: 'playing', ref: LEVEL_1 });
    // The tally game's hud score is its count: the middle example stands at 1.
    expect(opened?.handle.getView().hud.score).toBe(1);
    expect(save.doc().run?.state).toStrictEqual(TALLY_GAME.testing.examples.middle());
  });

  it('ends a result example at once: a win is recorded, a loss offers the continue', () => {
    const { host, save } = hostWith();
    host.debugControls().openExample('result-win');
    expect(host.openSession(EXAMPLE_RUN)?.handle.getView()).toMatchObject({ status: 'won' });
    expect(save.doc().progress.levels['1']).toBeDefined();
    host.debugControls().openExample('result-lose');
    const lost = host.openSession(EXAMPLE_RUN)?.handle.getView();
    expect(lost).toMatchObject({ status: 'lost', continueState: 'offered' });
  });

  it('drops a staged example when another run opens first', () => {
    const { host } = hostWith();
    host.debugControls().openExample('game-middle');
    host.openSession({ start: 'new', ref: { kind: 'level', level: 2 } });
    expect(host.openSession(EXAMPLE_RUN)?.handle.getView().hud.score).toBe(0);
  });

  it('shows the fixture numbers over the played run and never writes the save', () => {
    const { host, save } = hostWith();
    const opened = host.openSession({ start: 'new', ref: LEVEL_1 });
    const before = JSON.stringify(save.doc());
    host.debugControls().applyFixtureHud(FIXTURE);
    expect(opened?.handle.getView()).toMatchObject({
      status: 'playing',
      ref: { kind: 'level', level: 12 },
      hud: { score: 1840, goal: { kind: 'moves-par', moves: 7, par: 7 } },
    });
    host.debugControls().showFixtureResult(FIXTURE, 'won');
    expect(opened?.handle.getView()).toMatchObject({
      status: 'won',
      summary: { stars: 3, isNewBest: true, par: 7, levelBestScore: 1840, nextLevel: 13 },
    });
    expect(JSON.stringify(save.doc())).toBe(before);
  });
});
