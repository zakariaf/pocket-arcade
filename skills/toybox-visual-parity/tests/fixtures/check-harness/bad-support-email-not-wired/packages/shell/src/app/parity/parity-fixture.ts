// packages/shell/src/app/parity/parity-fixture.ts
// Test builds only (reached through test-only.ts). The design's demo player as save-document
// sections, read from parity-fixture-save.json (the frames manifest's fixtureSave block) and checked
// with the save's own schemas, so a fixture the save would refuse fails here, not on the simulator.
import * as v from 'valibot';

import { COUNT, DATE_KEY, KEBAB_ID } from '@e07/shell/services/save/schema/save-primitives.ts';
import { RUN_REF_V1 } from '@e07/shell/services/save/schema/save-run-v1.ts';
import {
  ADS_V1,
  DAILY_V1,
  HINTS_V1,
  PROGRESS_V1,
  SETTINGS_V1,
  STATS_V1,
  UPSELL_V1,
} from '@e07/shell/services/save/schema/save-sections-v1.ts';

import fixtureSave from './parity-fixture-save.json' with { type: 'json' };

const PARITY_FIXTURE_SCHEMA = v.strictObject({
  about: v.string(),
  /** Every frame is drawn on this day; the request's date must match it. */
  date: DATE_KEY,
  settings: SETTINGS_V1,
  progress: PROGRESS_V1,
  /** The level in progress ("Continue – Level 12"); the game module builds the run itself. */
  run: v.strictObject({ ref: RUN_REF_V1, resumeOnLaunch: v.boolean() }),
  daily: DAILY_V1,
  stats: v.omit(STATS_V1, ['counters']),
  /** Per design game id (lineSiege, flockTilt, scrapShove): CounterSpec id -> value. */
  counters: v.record(v.string(), v.record(KEBAB_ID, COUNT)),
  hints: HINTS_V1,
  ads: ADS_V1,
  /** Premium frames own it since ownedSinceMs; a later non-Premium frame revokes it at revokedAtMs. */
  premium: v.strictObject({ ownedSinceMs: COUNT, revokedAtMs: COUNT }),
  upsell: UPSELL_V1,
  /** The store product's price; the Shell formats it per language (never a typed price). */
  store: v.strictObject({
    price: v.pipe(v.number(), v.minValue(0)),
    currency: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)),
  }),
  /** S11 and S11b show "1.0.0 (8)": the version of the build plus this build number. */
  buildNumber: v.pipe(v.string(), v.regex(/^\d+$/)),
  /** The numbers the Game frames draw (S5, S6, S7); parityGameFixture() hands them out. */
  gameFrame: v.strictObject({
    about: v.string(),
    level: v.pipe(COUNT, v.minValue(1)),
    score: COUNT,
    bestScore: COUNT,
    isNewBest: v.boolean(),
    stars: v.picklist([1, 2, 3]),
    movesCount: COUNT,
    par: COUNT,
    isContinueOffered: v.boolean(),
    /** Per design game id: its progress params at mid and full, and its first lose-reason key. */
    games: v.record(
      v.string(),
      v.strictObject({
        progressMid: v.record(v.string(), COUNT),
        progressFull: v.record(v.string(), COUNT),
        loseReasonId: v.pipe(
          v.string(),
          v.regex(/^[a-z0-9]+(-[a-z0-9]+)*\.lose\.[a-z0-9]+(-[a-z0-9]+)*$/),
        ),
      }),
    ),
  }),
});

export type ParityFixture = v.InferOutput<typeof PARITY_FIXTURE_SCHEMA>;

/** Throws with the schema's message when the fixture is not a valid set of save sections. */
export function readParityFixture(json: unknown): ParityFixture {
  return v.parse(PARITY_FIXTURE_SCHEMA, json);
}

export const PARITY_FIXTURE: ParityFixture = readParityFixture(fixtureSave);

/** A request for another day than the fixture's would break every date the frames draw. */
export function parityDateProblem(
  date: string,
  fixture: ParityFixture = PARITY_FIXTURE,
): string | null {
  return date === fixture.date ? null : `date ${date} is not the fixture's day ${fixture.date}`;
}
