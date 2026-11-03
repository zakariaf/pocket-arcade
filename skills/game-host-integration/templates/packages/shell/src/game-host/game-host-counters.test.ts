// packages/shell/src/game-host/game-host-counters.test.ts
// GameHost.counters: the game's statistics counters as S10 reads them. Its own file because
// game-host.test.ts is at the test-file size limit.
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createGameHost } from './game-host.ts';

import type { GameHostDeps } from './game-host.ts';

function deps(): GameHostDeps {
  const { save } = createTestSave();
  return {
    save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: () => () => null,
    writeRunEnd: (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  };
}

describe('createGameHost', () => {
  it("hands S10 a best-of counter's style: a length asks for the plain number", () => {
    const [adds, biggest] = TALLY_GAME.stats.counters;
    if (adds === undefined || biggest === undefined) throw new Error('tally has two counters');
    const game: typeof TALLY_GAME = {
      ...TALLY_GAME,
      stats: { counters: [adds, { ...biggest, bestOfStyle: 'plain' }] },
    };

    expect(createGameHost(game, deps()).counters).toStrictEqual([
      { id: 'adds', labelId: 'tally.stats.adds', aggregate: 'sum' },
      { id: 'biggest-add', labelId: 'tally.stats.biggest', aggregate: 'max', bestOfStyle: 'plain' },
    ]);
  });
});
