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
});
