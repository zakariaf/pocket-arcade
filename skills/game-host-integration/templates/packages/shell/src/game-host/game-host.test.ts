// packages/shell/src/game-host/game-host.test.ts
import { isValidElement } from 'react';

import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createGameHost } from './game-host.ts';

import type {
  BoardHostFactory,
  ExamplePictureFactory,
  GameHost,
  GameHostDeps,
} from './game-host.ts';
import type { SessionHandle } from './session-view.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { TestSave } from '@e07/shell/testing/create-test-save.ts';

const noBoard: BoardHostFactory = () => () => null;
/** What the composition root's updateAndPublish does to the save (the stores are not part of these tests). */
const writeTo =
  (save: SaveService): GameHostDeps['writeRunEnd'] =>
  (write) => {
    save.update(write.recipe, { refreshBackup: write.refreshBackup });
  };
const LEVEL_1 = { kind: 'level', level: 1 } as const;
/** Level 1 of the tally game: reach exactly 4; column 0 adds 1, column 1 adds 2; par 2. */
const tap = (col: number) =>
  ({
    type: 'intent',
    intent: { kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null },
  }) as const;

function errorLog(): GameHostDeps['errorLog'] {
  return { record: jest.fn(), entries: () => [] };
}

function depsFor(test: TestSave): GameHostDeps {
  return {
    save: test.save,
    clock: TEST_CLOCK,
    errorLog: errorLog(),
    isContinueAllowed: true,
    createBoardHost: noBoard,
    writeRunEnd: writeTo(test.save),
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  };
}

function hostFor(test: TestSave, extra: Partial<GameHostDeps> = {}): GameHost {
  return createGameHost(TALLY_GAME, { ...depsFor(test), ...extra });
}

function open(test: TestSave, extra: Partial<GameHostDeps> = {}): SessionHandle {
  const opened = hostFor(test, extra).openSession({ start: 'new', ref: LEVEL_1 });
  if (opened === null) throw new Error('session did not open');
  return opened.handle;
}

function play(handle: SessionHandle, cols: readonly number[]): void {
  for (const col of cols) handle.send(tap(col));
}

describe('createGameHost', () => {
  it('names the game and its counters without exposing game types', () => {
    const host = hostFor(createTestSave());
    expect([host.id, host.counterIds]).toStrictEqual(['tally', ['adds', 'biggest-add']]);
    expect(host.counters).toStrictEqual([
      { id: 'adds', labelId: 'tally.stats.adds' },
      { id: 'biggest-add', labelId: 'tally.stats.biggest' },
    ]);
    expect(host.hasSavedRun()).toBe(false);
  });

  it('says whether the game has music and rates its levels by score (game-facts.ts)', () => {
    const host = hostFor(createTestSave());
    expect([host.hasMusic, host.isScoreRated]).toStrictEqual([false, false]);
    const theme = { category: 'music', recipe: [], isLoop: true } as const;
    const presentation = { ...TALLY_GAME.presentation, sounds: { theme } };
    const table = TALLY_GAME.levels.table.map((entry) => ({
      ...entry,
      stars: { kind: 'score', thresholds: [0, 20, 30] } as const,
    }));
    const game: typeof TALLY_GAME = {
      ...TALLY_GAME,
      presentation,
      levels: { ...TALLY_GAME.levels, table },
    };
    const scored = createGameHost(game, depsFor(createTestSave()));
    expect([scored.hasMusic, scored.isScoreRated]).toStrictEqual([true, true]);
  });

  it('hands S8 the level packs and S13 its pages and pictures, drawn by the board layer', () => {
    const page = {
      titleId: 'tally.goal',
      bodyId: 'tally.how-to-play.step-1',
      example: { count: 1, target: 3 },
      pointer: { kind: 'none' },
    } as const;
    const game = { ...TALLY_GAME, teaching: { ...TALLY_GAME.teaching, howToPlay: [page] } };
    const pictures: unknown[] = [];
    const createExamplePicture: ExamplePictureFactory = (typed) => {
      pictures.push(typed);
      return () => null;
    };
    const test = createTestSave();
    const deps = { ...depsFor(test), createExamplePicture };
    const host = createGameHost(game, deps);
    expect(host.packs).toBe(TALLY_GAME.levels.packs);
    expect(host.howToPlayPages).toStrictEqual([
      { titleId: 'tally.goal', bodyId: 'tally.how-to-play.step-1' },
    ]);
    expect(pictures).toStrictEqual([game]);
    expect(isValidElement(host.renderHowToPlayPicture(0))).toBe(true);
    expect(hostFor(createTestSave()).renderHowToPlayPicture(0)).toBeNull();
  });

  it('hands the Tutorial screen the coach steps without their typed moves', () => {
    expect(hostFor(createTestSave()).tutorialSteps).toStrictEqual([
      {
        messageId: 'tally.tutorial.add-one',
        pointer: { kind: 'target', target: { regionId: 'board', col: 0, row: 0 } },
      },
      {
        messageId: 'tally.tutorial.add-two',
        pointer: { kind: 'target', target: { regionId: 'board', col: 1, row: 0 } },
      },
    ]);
  });

  it('plays the tutorial by its script: a move the step does not expect is ignored', () => {
    const opened = hostFor(createTestSave()).openSession({
      start: 'new',
      ref: { kind: 'tutorial' },
    });
    if (opened === null) throw new Error('no tutorial');
    opened.handle.send(tap(1));
    expect(opened.handle.getView().moveCount).toBe(0);
    play(opened.handle, [0, 0]);
    expect(opened.handle.getView().moveCount).toBe(1);
    opened.handle.send(tap(1));
    expect(opened.handle.getView().status).toBe('won');
  });

  it('ends a skipped tutorial run with finish: the run is cleared and nothing is counted', () => {
    const test = createTestSave();
    const opened = hostFor(test).openSession({ start: 'new', ref: { kind: 'tutorial' } });
    if (opened === null) throw new Error('no tutorial');
    opened.handle.send(tap(0));
    expect(test.save.doc().run?.ref).toStrictEqual({ kind: 'tutorial' });
    opened.handle.send({ type: 'finish' });
    expect(test.save.doc().run).toBeNull();
    expect(test.save.doc().stats.gamesPlayed).toBe(0);
  });

  it('hands screens the name and win title keys, the logo and the credits as plain data', () => {
    const host = hostFor(createTestSave());
    expect([host.nameId, host.winTitleId, host.taglineId]).toStrictEqual([
      'tally.name',
      'tally.win-title',
      'tally.tagline',
    ]);
    expect(host.logo).toBe(TALLY_GAME.presentation.art.logo);
    expect(host.credits).toStrictEqual([]);
  });

  it('hands the board layer the typed game, the run and the full-screen ad gate', () => {
    const inputs: unknown[] = [];
    const createBoardHost: BoardHostFactory = (input) => {
      inputs.push(input);
      return () => null;
    };
    const host = hostFor(createTestSave(), { createBoardHost });
    host.openSession({ start: 'new', ref: LEVEL_1 });
    expect(inputs).toStrictEqual([
      expect.objectContaining({ game: TALLY_GAME, lifecycle: host.lifecycle }),
    ]);
  });

  it('writes a new run before the first move, so Home can offer Continue', () => {
    const test = createTestSave();
    open(test);
    expect(test.readSlot('current').run?.ref).toStrictEqual(LEVEL_1);
  });

  it('opens an endless run with a seed from the clock and reports the saved run', () => {
    const test = createTestSave();
    const host = hostFor(test);
    const opened = host.openSession({ start: 'new', ref: { kind: 'endless' } });
    expect(opened?.handle.getView().ref).toStrictEqual({ kind: 'endless' });
    expect(test.readSlot('current').run?.seed).toBe(TEST_CLOCK.nowMs() % 4_294_967_296);
    expect(host.hasSavedRun()).toBe(true);
  });

  it("starts an endless run from a test build's debug seed instead of the clock", () => {
    const test = createTestSave();
    const host = hostFor(test, { seedOverride: () => 42 });
    host.openSession({ start: 'new', ref: { kind: 'endless' } });
    expect(test.readSlot('current').run?.seed).toBe(42);
  });

  it('opens nothing for an unknown level or a missing saved run', () => {
    const host = hostFor(createTestSave());
    expect(host.openSession({ start: 'new', ref: { kind: 'level', level: 99 } })).toBeNull();
    expect(host.openSession({ start: 'resume' })).toBeNull();
  });

  it('saves a move before it shows and resumes the run paused after a relaunch', () => {
    const test = createTestSave();
    play(open(test), [0]);
    expect(test.readSlot('current').run?.moveCount).toBe(1);
    const resumed = hostFor(test).openSession({ start: 'resume' });
    expect(resumed?.handle.getView()).toMatchObject({ status: 'paused', moveCount: 1 });
    resumed?.handle.send({ type: 'resume' });
    expect(resumed?.handle.getView()).toMatchObject({ status: 'playing', canUndo: true });
  });

  it('drops a saved run the game cannot read at boot and logs it', () => {
    const test = createTestSave();
    open(test);
    test.save.update((doc) =>
      doc.run === null ? doc : { ...doc, run: { ...doc.run, state: 'garbage' } },
    );
    const log = errorLog();
    hostFor(test, { errorLog: log });
    expect(test.readSlot('current').run).toBeNull();
    expect(log.record).toHaveBeenCalledWith('save', new Error('saved run dropped: state-invalid'));
  });
});

describe('a session', () => {
  it('records a win in one update with the backup, stars and counters before S7', () => {
    const test = createTestSave();
    const handle = open(test);
    play(handle, [1, 1]);
    expect(handle.getView().summary).toMatchObject({
      isWon: true,
      stars: 3,
      moves: 2,
      par: 2,
      nextLevel: 2,
    });
    const backup = test.readSlot('backup');
    expect(backup.run).toBeNull();
    expect(backup.progress.levels['1']).toMatchObject({ stars: 3, completions: 1 });
    expect(backup.stats).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      counters: { adds: 2, 'biggest-add': 2 },
    });
  });

  it('sounds the decided result once: ui.win with a success pulse', () => {
    const audio = createFakeAudio();
    const haptics = createFakeHaptics();
    const handle = open(createTestSave(), { feedback: { audio, haptics } });
    play(handle, [1]);
    expect(audio.calls).toStrictEqual([]);
    play(handle, [1]);
    handle.send({ type: 'finish' });
    expect(audio.calls).toStrictEqual([{ kind: 'play', soundId: 'ui.win', delayMs: 0 }]);
    expect(haptics.played).toStrictEqual(['success']);
  });

  it('hands the run end to writeRunEnd once, with the backup refreshed', () => {
    const test = createTestSave();
    const writeRunEnd = jest.fn(writeTo(test.save));
    play(open(test, { writeRunEnd }), [1, 1]);
    expect(writeRunEnd).toHaveBeenCalledTimes(1);
    expect(writeRunEnd.mock.calls[0]?.[0].refreshBackup).toBe(true);
    expect(test.readSlot('backup').stats.gamesPlayed).toBe(1);
  });

  it('adds the extra run-end sections in the same update', () => {
    const test = createTestSave();
    const extendRunEnd = jest.fn(
      (doc: Parameters<NonNullable<GameHostDeps['extendRunEnd']>>[0]) => ({
        ...doc,
        upsell: { lastShownOn: '2026-09-26' },
      }),
    );
    play(open(test, { extendRunEnd }), [1, 1]);
    expect(extendRunEnd).toHaveBeenCalledTimes(1);
    expect(test.readSlot('backup').upsell.lastShownOn).toBe('2026-09-26');
  });

  it('keeps a loss pending while the continue is offered, then continues once', () => {
    const test = createTestSave();
    const handle = open(test);
    play(handle, [1, 0, 1]);
    expect(handle.getView()).toMatchObject({
      status: 'lost',
      continueState: 'offered',
      loseReasonKey: 'tally.lose.overshot',
      summary: null,
    });
    expect(test.readSlot('current').run?.moveCount).toBe(3);
    handle.send({ type: 'continue' });
    expect(handle.getView()).toMatchObject({ status: 'playing', continueState: 'used' });
    play(handle, [1]);
    expect(handle.getView().summary).toMatchObject({
      isWon: false,
      loseReasonKey: 'tally.lose.overshot',
    });
  });

  it('records the pending loss when the player declines the continue', () => {
    const test = createTestSave();
    const handle = open(test);
    play(handle, [1, 0, 1]);
    handle.send({ type: 'finish' });
    expect(handle.getView().summary).toMatchObject({ isWon: false, stars: 0 });
    expect(test.readSlot('backup').stats.losses).toBe(1);
  });

  it('records a loss at once when the app switches the continue off', () => {
    const handle = open(createTestSave(), { isContinueAllowed: false });
    play(handle, [1, 0, 1]);
    expect(handle.getView()).toMatchObject({ continueState: 'none', summary: { isWon: false } });
  });

  it('keeps the run for Home but not for a relaunch when the player leaves from Pause', () => {
    const test = createTestSave();
    const handle = open(test);
    play(handle, [0]);
    handle.send({ type: 'pause' });
    handle.send({ type: 'leave' });
    expect(test.readSlot('current').run).toMatchObject({ moveCount: 1, resumeOnLaunch: false });
  });

  it('shows a paid hint for the current position and counts it', () => {
    const test = createTestSave();
    const handle = open(test);
    handle.send({ type: 'hint' });
    expect(handle.getView()).toMatchObject({ isHintSupported: true, isHintShown: true });
    expect(test.readSlot('current').run?.hintsUsed).toBe(1);
    play(handle, [0]);
    expect(handle.getView().isHintShown).toBe(false);
  });

  it('shows no hint in a game without hints, after the game ended or when the solver has none', () => {
    const noHints = {
      ...TALLY_GAME,
      rules: { ...TALLY_GAME.rules, hints: { kind: 'none' } },
    } as const;
    const first = createTestSave().save;
    const deps = {
      save: first,
      clock: TEST_CLOCK,
      errorLog: errorLog(),
      isContinueAllowed: true,
      createBoardHost: noBoard,
      writeRunEnd: writeTo(first),
      feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
    };
    const plain = createGameHost(noHints, deps).openSession({ start: 'new', ref: LEVEL_1 });
    plain?.handle.send({ type: 'hint' });
    expect(plain?.handle.getView()).toMatchObject({ isHintSupported: false, isHintShown: false });
    const silent = {
      ...TALLY_GAME,
      rules: { ...TALLY_GAME.rules, hints: { kind: 'solver', suggest: () => null } },
    } as const;
    const second = createTestSave().save;
    const quiet = createGameHost(silent, {
      ...deps,
      save: second,
      writeRunEnd: writeTo(second),
    }).openSession({
      start: 'new',
      ref: LEVEL_1,
    });
    quiet?.handle.send({ type: 'hint' });
    expect(quiet?.handle.getView().isHintShown).toBe(false);
  });

  it('records a finished run once, even when asked again or on leaving', () => {
    const test = createTestSave();
    const handle = open(test);
    play(handle, [1, 1]);
    const summary = handle.getView().summary;
    handle.send({ type: 'finish' });
    handle.send({ type: 'leave' });
    handle.send({ type: 'hint' });
    expect(handle.getView().summary).toBe(summary);
    expect(test.readSlot('backup').stats.gamesPlayed).toBe(1);
  });

  it('records the pending loss when the player leaves the lose screen', () => {
    const test = createTestSave();
    const handle = open(test);
    play(handle, [1, 0, 1]);
    handle.send({ type: 'leave' });
    expect(handle.getView().summary).toMatchObject({ isWon: false });
    expect(test.readSlot('current').run).toBeNull();
  });

  it('does nothing on finish while the run is still playing', () => {
    const test = createTestSave();
    const handle = open(test);
    handle.send({ type: 'finish' });
    expect(handle.getView()).toMatchObject({ status: 'playing', summary: null });
  });

  it('ignores intents that are no move and an undo with nothing to undo', () => {
    const handle = open(createTestSave());
    handle.send({ type: 'intent', intent: { kind: 'aim', dx: 1, dy: 1 } });
    handle.send({ type: 'undo' });
    expect(handle.getView()).toMatchObject({ moveCount: 0, isUndoSupported: true, canUndo: false });
  });

  it('counts play time between commands only while playing, clamped per step', () => {
    let now = 1_790_424_000_000;
    const handle = open(createTestSave(), { clock: { ...TEST_CLOCK, nowMs: () => now } });
    now += 10_000;
    play(handle, [0]);
    now += 3_600_000;
    handle.send({ type: 'pause' });
    now += 50_000;
    handle.send({ type: 'resume' });
    now += 5_000;
    play(handle, [1]);
    now += 2_000;
    play(handle, [0]);
    expect(handle.getView().summary?.playMs).toBe(10_000 + 300_000 + 5_000 + 2_000);
  });

  it('notifies subscribers of every change and gives a stable view in between', () => {
    const handle = open(createTestSave());
    const listener = jest.fn();
    const stop = handle.subscribe(listener);
    const before = handle.getView();
    expect(handle.getView()).toBe(before);
    play(handle, [0]);
    expect(listener).toHaveBeenCalled();
    expect(handle.getView()).not.toBe(before);
    stop();
  });
});
