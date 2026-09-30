// packages/shell/src/app/hydrate-save.test.ts
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import { hydrateSave, resumeState } from './hydrate-save.ts';

import type { FakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const GAME_ID = 'probe-game';

function hydrate(store: FakeSaveStore = createFakeSaveStore()) {
  const errorLog = createFakeErrorLog(TEST_CLOCK);
  const deps = { store, clock: TEST_CLOCK, errorLog, gameId: GAME_ID, appVersion: '1.0.0' };
  return { store, errorLog, hydrated: hydrateSave(deps) };
}

/** A save past the tutorial whose level run was open when the app was killed. */
function killedInALevel(isResumedOnLaunch: boolean): SaveDoc {
  const base = createDefaultSaveDoc(GAME_ID);
  return {
    ...base,
    firstRun: { languageChosen: true, tutorialDone: true },
    run: {
      ref: { kind: 'level', level: 12 },
      stateVersion: 1,
      seed: 7,
      difficulty: 40,
      state: {},
      log: [],
      moveCount: 0,
      undoCount: 0,
      hintsUsed: 0,
      continuesUsed: 0,
      playMs: 0,
      resumeOnLaunch: isResumedOnLaunch,
    },
  };
}

describe('hydrateSave', () => {
  it('starts a first launch from a fresh document written to both slots, with no resume', () => {
    const { store, hydrated } = hydrate();
    expect(hydrated.outcome).toStrictEqual({ kind: 'fresh' });
    expect([store.slots.has('current'), store.slots.has('backup')]).toStrictEqual([true, true]);
    expect(hydrated.save.doc().gameId).toBe(GAME_ID);
    expect(hydrated.initialState).toBeUndefined();
  });

  it('loads the document a previous launch wrote, synchronously', () => {
    const first = hydrate();
    first.hydrated.save.update((doc) => ({
      ...doc,
      firstRun: { ...doc.firstRun, tutorialDone: true },
    }));
    const { hydrated } = hydrate(first.store);
    expect(hydrated.outcome).toStrictEqual({ kind: 'loaded' });
    expect(hydrated.save.doc().firstRun.tutorialDone).toBe(true);
  });

  it('plays a save.db from a newer app in memory, read-only, without writing', () => {
    const store = createFakeSaveStore();
    store.newerStructure = 9;
    const { hydrated } = hydrate(store);
    expect(hydrated.outcome).toStrictEqual({ kind: 'newer-version', found: 9 });
    expect(store.slots.size).toBe(0);
  });
});

describe('resumeState', () => {
  it('reopens a killed level on Game (paused) above Home', () => {
    expect(resumeState(killedInALevel(true))).toStrictEqual({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }],
    });
  });

  it('lands on Home after Pause -> Home, and never resumes before the tutorial is done', () => {
    expect(resumeState(killedInALevel(false))).toBeUndefined();
    const firstRun = { languageChosen: true, tutorialDone: false };
    expect(resumeState({ ...killedInALevel(true), firstRun })).toBeUndefined();
  });
});
