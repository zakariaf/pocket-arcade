// test/integration/game-host/snare-snake-v1-run.test.ts
// Spec 8.6 and N10: a run survives every app update. A run saved by Snare Snake's state version 1
// (the frozen fixtures: the first build without a heading, a later one with it) is read by the new
// build through migrateState at boot, resumed paused, and saved again at version 2.
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { snareSnakeGame as game } from '@e07/snare-snake/index.ts';
import v1Runs from '@e07/snare-snake/rules/fixtures/save-v1-run-states.json';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';

/** A launch of the app over `save`: the host checks the saved run at boot, as the Shell does. */
function launch(save: SaveService) {
  const recorded: string[] = [];
  const host = createGameHost(game, {
    save,
    clock: TEST_CLOCK,
    errorLog: {
      record: (_source, error) => {
        recorded.push(error instanceof Error ? error.message : String(error));
      },
      entries: () => [],
    },
    isContinueAllowed: game.rules.continueRun.kind === 'once',
    createBoardHost: () => () => null,
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
    writeRunEnd: (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
  });
  return { host, recorded };
}

/** A save whose level run was written by version 1 with this state (no move log kept). */
function saveWithV1Run(state: unknown): SaveService {
  const { save } = createTestSave();
  launch(save).host.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
  save.update((doc) =>
    doc.run === null ? doc : { ...doc, run: { ...doc.run, stateVersion: 1, state, log: [] } },
  );
  return save;
}

describe('a Snare Snake run saved by state version 1', () => {
  it.each([
    ['the first build, without a heading', v1Runs['first-build'], null],
    ['a later version-1 build, with its heading', v1Runs['heading-build'], 'right'],
  ])('comes back after the update: %s', (_name, state, heading) => {
    const save = saveWithV1Run(state);
    const relaunch = launch(save);
    expect(relaunch.recorded).toStrictEqual([]);
    const resumed = relaunch.host.openSession({ start: 'resume' });
    expect(resumed?.handle.getView().status).toBe('paused');
    expect(save.doc().run).toMatchObject({ stateVersion: 1, state });
    const migrated = game.persistence.migrateState(state, 1);
    const step = migrated === null ? undefined : game.engine.listMoves(migrated)[0];
    if (step === undefined) throw new Error('the version-1 run has a legal move');
    resumed?.handle.send({ type: 'resume' });
    resumed?.handle.send({
      type: 'intent',
      intent: { kind: 'swipe', direction: step.direction, from: null },
    });
    expect(migrated?.heading).toBe(heading);
    expect(save.doc().run).toMatchObject({
      stateVersion: 2,
      state: game.engine.applyMove(migrated ?? game.teaching.tutorial.start, step).state,
    });
  });
});
