// packages/shell/src/services/save/schema/save-run-v1.ts
import * as v from 'valibot';

import {
  COUNT,
  DATE_KEY,
  DIFFICULTY,
  LEVEL_NUMBER,
  UINT32,
} from '@e07/shell/services/save/schema/save-primitives.ts';

export const RUN_REF_V1 = v.variant('kind', [
  v.strictObject({ kind: v.literal('level'), level: LEVEL_NUMBER }),
  v.strictObject({ kind: v.literal('daily'), date: DATE_KEY }),
  v.strictObject({ kind: v.literal('endless') }),
  v.strictObject({ kind: v.literal('tutorial') }),
]);

export const RUN_LOG_ENTRY_V1 = v.variant('kind', [
  /** move is the game's JSON move; the game module validates it on replay. */
  v.strictObject({ kind: v.literal('move'), move: v.unknown() }),
  v.strictObject({ kind: v.literal('continue') }),
]);

/** The in-progress level. `state` belongs to the game (PersistenceSpec). */
export const RUN_V1 = v.strictObject({
  ref: RUN_REF_V1,
  seed: UINT32,
  difficulty: DIFFICULTY,
  stateVersion: v.pipe(COUNT, v.minValue(1)),
  state: v.unknown(),
  log: v.array(RUN_LOG_ENTRY_V1),
  moveCount: COUNT,
  undoCount: COUNT,
  hintsUsed: COUNT,
  continuesUsed: COUNT,
  playMs: COUNT,
  /** true while the Game screen is open: a relaunch reopens it, paused (spec S5). */
  resumeOnLaunch: v.boolean(),
});
