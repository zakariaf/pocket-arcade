// packages/shell/src/app/leave-run-after-crash.test.ts
import { newSession } from '@e07/shell/game-host/open-session.ts';
import { writeRun } from '@e07/shell/game-host/run-writer.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { leaveRunAfterCrash } from './leave-run-after-crash.ts';

describe('leaveRunAfterCrash', () => {
  it('keeps the crashed run but makes the next launch land on Home (spec 8.14)', () => {
    // spec 8.14: "a broken level falls back to Home with a gentle message, never a crash loop".
    const { save } = createTestSave();
    const session = newSession(TALLY_GAME, { kind: 'level', level: 1 }, () => 1);
    if (session === null) throw new Error('no run');
    writeRun({ save, persistence: TALLY_GAME.persistence }, session, true);
    leaveRunAfterCrash(save);
    expect(save.doc().run).toMatchObject({
      ref: { kind: 'level', level: 1 },
      state: session.state,
      resumeOnLaunch: false,
    });
  });

  it('leaves a save without a run as it is', () => {
    const { save } = createTestSave();
    const before = save.doc();
    leaveRunAfterCrash(save);
    expect(save.doc()).toStrictEqual(before);
  });
});
