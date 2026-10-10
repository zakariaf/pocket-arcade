// packages/shell/src/game-host/game-host-music.test.ts
// GameHost.musicSoundId: the sound Home starts (spec S4, 8.7). Its own file because
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
  it("names the game's music sound for Home, and none for a game without music (spec 8.7)", () => {
    expect(createGameHost(TALLY_GAME, deps()).musicSoundId).toBeNull();

    const sounds = { theme: { category: 'music', recipe: [], isLoop: true } } as const;
    const game: typeof TALLY_GAME = {
      ...TALLY_GAME,
      presentation: { ...TALLY_GAME.presentation, sounds },
    };
    expect(createGameHost(game, deps()).musicSoundId).toBe('theme');
  });
});
