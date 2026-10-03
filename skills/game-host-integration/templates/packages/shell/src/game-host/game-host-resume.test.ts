// packages/shell/src/game-host/game-host-resume.test.ts
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createGameHost } from './game-host.ts';

import type { GameHostDeps } from './game-host.ts';
import type { SessionHandle } from './session-view.ts';
import type { TestSave } from '@e07/shell/testing/create-test-save.ts';

const LEVEL_1 = { kind: 'level', level: 1 } as const;

function depsFor(test: TestSave): GameHostDeps {
  return {
    save: test.save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    writeRunEnd: (write) => {
      test.save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  };
}

/** Taps on level 1 of the tally game (target 4): column 0 adds 1, so two taps never finish it. */
function addOnes(handle: SessionHandle | undefined, taps: number): void {
  if (handle === undefined) throw new Error('session did not open');
  for (let tap = 0; tap < taps; tap += 1) {
    handle.send({
      type: 'intent',
      intent: { kind: 'tap', target: { regionId: 'board', col: 0, row: 0 }, selected: null },
    });
  }
}

/** Taps column 1 (adds 2) on an open run. */
function addTwos(handle: SessionHandle | undefined, taps: number): void {
  if (handle === undefined) throw new Error('session did not open');
  for (let tap = 0; tap < taps; tap += 1) {
    handle.send({
      type: 'intent',
      intent: { kind: 'tap', target: { regionId: 'board', col: 1, row: 0 }, selected: null },
    });
  }
}

/** The tally game with stricter rules: a move past the target is illegal (RangeError). */
const STRICT_TALLY: typeof TALLY_GAME = {
  ...TALLY_GAME,
  engine: {
    ...TALLY_GAME.engine,
    applyMove: (state, move) => {
      if (state.count + move.amount > state.target) throw new RangeError('past the target');
      return TALLY_GAME.engine.applyMove(state, move);
    },
  },
};

/**
 * A level 1 run saved by an older rule set (target 10 where create now makes 4): its one logged
 * move replays to another position, so the restore keeps the position and drops the history.
 */
function saveOlderRun(test: TestSave): void {
  addOnes(
    createGameHost(TALLY_GAME, depsFor(test)).openSession({ start: 'new', ref: LEVEL_1 })?.handle,
    1,
  );
  test.save.update((doc) =>
    doc.run === null
      ? doc
      : {
          ...doc,
          run: {
            ...doc.run,
            state: { count: 2, target: 10 },
            log: [{ kind: 'move', move: { kind: 'add', amount: 2 } }],
          },
        },
  );
}

describe('createGameHost resume', () => {
  it('replays a saved run once from boot to its first resume (spec 8.6)', () => {
    const test = createTestSave();
    addOnes(
      createGameHost(TALLY_GAME, depsFor(test)).openSession({ start: 'new', ref: LEVEL_1 })?.handle,
      2,
    );
    const applyMove = jest.fn(TALLY_GAME.engine.applyMove);
    const game: typeof TALLY_GAME = { ...TALLY_GAME, engine: { ...TALLY_GAME.engine, applyMove } };
    const resumed = createGameHost(game, depsFor(test)).openSession({ start: 'resume' });
    expect(resumed?.handle.getView()).toMatchObject({ status: 'paused', moveCount: 2 });
    expect(applyMove).toHaveBeenCalledTimes(2);
  });

  it('resumes the run on disk, not the one checked at boot, once the save has moved on', () => {
    const test = createTestSave();
    addOnes(
      createGameHost(TALLY_GAME, depsFor(test)).openSession({ start: 'new', ref: LEVEL_1 })?.handle,
      1,
    );
    const host = createGameHost(TALLY_GAME, depsFor(test));
    addOnes(host.openSession({ start: 'new', ref: LEVEL_1 })?.handle, 2);
    const resumed = host.openSession({ start: 'resume' });
    expect(resumed?.handle.getView()).toMatchObject({ status: 'paused', moveCount: 2 });
  });

  it('boots and resumes when the saved moves no longer replay (spec 8.14 never a crash loop)', () => {
    const test = createTestSave();
    saveOlderRun(test);
    const first = createGameHost(STRICT_TALLY, depsFor(test)).openSession({ start: 'resume' });
    // Played on after the restore: the kept log [2, 2, 2] cannot replay from create (target 4).
    first?.handle.send({ type: 'resume' });
    addTwos(first?.handle, 3);
    const boot = (): ReturnType<typeof createGameHost> =>
      createGameHost(STRICT_TALLY, depsFor(test));
    expect(boot).not.toThrow();
    const resumed = boot().openSession({ start: 'resume' });
    expect(resumed?.handle.getView()).toMatchObject({ status: 'paused', canUndo: false });
    expect(test.save.doc().run?.state).toStrictEqual({ count: 8, target: 10 });
  });
});
