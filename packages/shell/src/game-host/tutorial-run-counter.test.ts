// packages/shell/src/game-host/tutorial-run-counter.test.ts
// S13 and S6: "Play the tutorial again" from Pause during the tutorial must start it afresh. Its
// request carries the host's tutorial run count (GameParams.replay), so it differs from the params
// the open Game screen's tutorial came with.
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createGameHost } from './game-host.ts';
import { countTutorialRuns } from './tutorial-run-counter.ts';

import type { GameHost } from './game-host.ts';

const TUTORIAL = { start: 'new', ref: { kind: 'tutorial' } } as const;

function host(): GameHost {
  const test = createTestSave();
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

describe('tutorial run count', () => {
  it('counts the tutorial runs the host opened, and no other run', () => {
    const counted = host();
    const before = counted.tutorialRunCount();
    counted.openSession(TUTORIAL);
    counted.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
    counted.openSession(TUTORIAL);
    expect([before, counted.tutorialRunCount()]).toStrictEqual([0, 2]);
  });

  it('counts a tutorial only once its run opened', () => {
    const counted = countTutorialRuns((open) => (open.start === 'resume' ? 'resumed' : null));
    counted.openSession(TUTORIAL);
    counted.openSession({ start: 'resume' });
    expect(counted.tutorialRunCount()).toBe(0);
  });
});
