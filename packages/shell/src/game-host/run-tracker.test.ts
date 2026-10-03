// packages/shell/src/game-host/run-tracker.test.ts
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { entryFor, newSession, sessionRulesFor } from './open-session.ts';
import { createRunTracker } from './run-tracker.ts';
import { createSessionController } from './session-controller.ts';

import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';
import type { TallyTypes } from '@e07/shell/testing/tally-game.ts';

/** A tally controller for `ref`, built the way createGameHost builds one. */
function controllerFor(ref: RunRef) {
  const { save } = createTestSave();
  const session = newSession(TALLY_GAME, ref, () => 1);
  if (session === null) throw new Error('no run');
  return createSessionController(
    {
      rules: sessionRulesFor(TALLY_GAME, ref),
      hud: TALLY_GAME.rules.hud,
      counters: TALLY_GAME.stats.counters,
      entry: entryFor(TALLY_GAME, ref),
      table: TALLY_GAME.levels.table,
      engine: TALLY_GAME.engine,
      gameRules: TALLY_GAME.rules,
      persistence: TALLY_GAME.persistence,
      save,
      today: TEST_CLOCK.today,
      nowMs: TEST_CLOCK.nowMs,
      isContinueAllowed: true,
      writeRunEnd: (write) => {
        save.update(write.recipe, { refreshBackup: write.refreshBackup });
      },
      feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
    },
    session,
  );
}

const LEVEL_1 = { kind: 'level', level: 1 } as const;
const EXAMPLE = { state: { count: 1, target: 4 }, endsAs: null } as const;

describe('createRunTracker', () => {
  it('follows the last opened run until it is left for Home, never the tutorial', () => {
    const runs = createRunTracker<TallyTypes>();
    expect(runs.active()).toBeNull();
    const level = controllerFor(LEVEL_1);
    const handle = runs.track(level);
    expect(runs.active()).toBe(level);
    handle.send({ type: 'pause' });
    expect(runs.active()).toBe(level);
    handle.send({ type: 'leave' });
    expect(runs.active()).toBeNull();
    runs.track(controllerFor({ kind: 'tutorial' }));
    expect(runs.active()).toBeNull();
  });

  it('acts on a daily or an endless run like a level: action= ends any active run', () => {
    const runs = createRunTracker<TallyTypes>();
    const daily = controllerFor({ kind: 'daily', date: TEST_CLOCK.today() });
    runs.track(daily);
    expect(runs.active()).toBe(daily);
    const endless = controllerFor({ kind: 'endless' });
    const handle = runs.track(endless);
    expect(runs.active()).toBe(endless);
    handle.send({ type: 'leave' });
    expect(runs.active()).toBeNull();
  });

  it('hands a staged example only to the next new level-1 run, once', () => {
    const runs = createRunTracker<TallyTypes>();
    runs.stage(EXAMPLE);
    expect(runs.take({ start: 'resume' })).toBeNull();
    expect(runs.take({ start: 'new', ref: LEVEL_1 })).toBeNull();
    runs.stage(EXAMPLE);
    expect(runs.take({ start: 'new', ref: LEVEL_1 })).toBe(EXAMPLE);
    expect(runs.take({ start: 'new', ref: LEVEL_1 })).toBeNull();
  });
});
