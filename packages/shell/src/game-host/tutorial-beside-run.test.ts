// packages/shell/src/game-host/tutorial-beside-run.test.ts
// N10 and S13: "Play the tutorial again" (from Pause, or with Continue on Home) must never throw
// away the run the save holds; the save has one run slot.
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createGameHost } from './game-host.ts';
import { isTutorialBesideRun, runWritesOf, saveWithoutWrites } from './tutorial-beside-run.ts';

import type { GameHost } from './game-host.ts';
import type { SessionHandle } from './session-view.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';
import type { TestSave } from '@e07/shell/testing/create-test-save.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;
const TUTORIAL = { kind: 'tutorial' } as const;
/** Level 1 of the tally game: column 0 adds 1, column 1 adds 2. */
const tap = (col: number) =>
  ({
    type: 'intent',
    intent: { kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null },
  }) as const;

function hostFor(test: TestSave): GameHost {
  return createGameHost(TALLY_GAME, {
    save: test.save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    writeRunEnd: (write) => {
      test.save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  });
}

function opened(host: GameHost, ref: RunRef): SessionHandle {
  const session = host.openSession({ start: 'new', ref });
  if (session === null) throw new Error(`no ${ref.kind} run`);
  return session.handle;
}

function play(handle: SessionHandle, cols: readonly number[]): void {
  for (const col of cols) handle.send(tap(col));
}

describe('isTutorialBesideRun', () => {
  it('is true only for a tutorial while the save holds a run of another kind', () => {
    const test = createTestSave();
    expect(isTutorialBesideRun(test.save, TUTORIAL)).toBe(false);
    const host = hostFor(test);
    opened(host, TUTORIAL);
    expect(isTutorialBesideRun(test.save, TUTORIAL)).toBe(false);
    opened(host, LEVEL_1);
    expect(isTutorialBesideRun(test.save, TUTORIAL)).toBe(true);
    expect(isTutorialBesideRun(test.save, LEVEL_1)).toBe(false);
  });
});

describe('saveWithoutWrites', () => {
  it('reads the document and writes nothing, answering that nothing reached the disk', () => {
    const test = createTestSave();
    const quiet = saveWithoutWrites(test.save);
    expect(quiet.doc()).toBe(test.save.doc());
    expect(quiet.update((doc) => ({ ...doc, run: null }), { refreshBackup: true })).toBe(false);
    expect(test.save.doc()).toStrictEqual(test.readSlot('current'));
  });
});

describe('runWritesOf', () => {
  it("keeps the host's writers for every run but a tutorial beside a saved run", () => {
    const test = createTestSave();
    const writes = { save: test.save, writeRunEnd: jest.fn() };
    expect(runWritesOf(writes, TUTORIAL)).toBe(writes);
    opened(hostFor(test), LEVEL_1);
    expect(runWritesOf(writes, LEVEL_1)).toBe(writes);
    const beside = runWritesOf(writes, TUTORIAL);
    beside.writeRunEnd({ recipe: (doc) => doc, refreshBackup: true });
    expect(writes.writeRunEnd).not.toHaveBeenCalled();
    expect(beside.save.update((doc) => ({ ...doc, run: null }))).toBe(false);
    expect(test.readSlot('current').run?.ref).toStrictEqual(LEVEL_1);
  });
});

describe('a tutorial beside a saved run', () => {
  it('leaves the saved run in the save through its moves, pause, leave and end (N10)', () => {
    const test = createTestSave();
    const host = hostFor(test);
    const level = opened(host, LEVEL_1);
    play(level, [0]);
    level.send({ type: 'pause' });
    const saved = test.readSlot('current').run;

    const left = opened(host, TUTORIAL);
    play(left, [0]);
    left.send({ type: 'pause' });
    left.send({ type: 'leave' });
    expect(test.readSlot('current').run).toStrictEqual(saved);

    const played = opened(host, TUTORIAL);
    play(played, [0, 1]);
    expect(played.getView().status).toBe('won');
    expect(test.readSlot('current').run).toStrictEqual(saved);
    expect(test.save.doc().stats.gamesPlayed).toBe(0);
  });

  it('saves the first-launch tutorial in an empty slot, as before', () => {
    const test = createTestSave();
    play(opened(hostFor(test), TUTORIAL), [0]);
    expect(test.readSlot('current').run?.ref).toStrictEqual(TUTORIAL);
  });
});
