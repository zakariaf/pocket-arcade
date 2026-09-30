// packages/shell/src/app/hydrate-save.ts
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { lastWriteCount, planLoad } from '@e07/shell/services/save/load-plan.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { LoadOutcome } from '@e07/shell/services/save/load-plan.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveStore } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { InitialState } from '@react-navigation/native';

export type HydrateDeps = {
  /** createSqliteSaveStore(driver) over save.db on a device; createFakeSaveStore() in tests. */
  readonly store: SaveStore;
  readonly clock: Pick<ClockPort, 'nowMs'>;
  readonly errorLog: ErrorLogPort;
  readonly gameId: string;
  readonly appVersion: string;
};

export type Hydrated = {
  readonly save: SaveService;
  /** Drives the S14 dialog shown on the first screen (backup restored, newer save…). */
  readonly outcome: LoadOutcome;
  readonly initialState: InitialState | undefined;
};

/** Relaunch inside a level lands on Game (paused) above Home (spec S5). */
export function resumeState(doc: SaveDoc): InitialState | undefined {
  if (!doc.firstRun.tutorialDone || doc.run?.resumeOnLaunch !== true) return undefined;
  return { index: 1, routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }] };
}

/**
 * S1 work, all synchronous: read both slots -> plan -> apply planned writes. Never throws for
 * data reasons: a damaged row falls back, and a save.db from a newer app (its rows or its
 * tables) plays in memory, read-only, with the `newer-version` outcome (never a crash loop).
 */
export function hydrateSave(deps: HydrateDeps): Hydrated {
  const { store } = deps;
  const input = {
    current: store.read('current'),
    backup: store.read('backup'),
    gameId: deps.gameId,
    newerStructure: store.newerStructureVersion(),
  };
  const plan = planLoad(input);
  const { clock, errorLog, appVersion } = deps;
  const save = createSaveService(
    { store, clock, errorLog, appVersion, isStrict: TEST_ONLY !== null },
    plan,
    lastWriteCount(input),
  );
  save.applyLoadWrites();
  return { save, outcome: plan.outcome, initialState: resumeState(save.doc()) };
}
