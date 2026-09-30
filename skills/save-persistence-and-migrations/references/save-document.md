# The save document (version 1)

Everything the player owns is one versioned JSON document, validated with valibot 1.5.0 on every load and before every write, stored twice (`current` and `backup`) in `save.db`. This file is the complete v1 shape and why it looks this way.

## Contents

- Product rules the document serves
- Why valibot
- Sections, and what each reset clears
- The schema files
- The primitives
- The sections
- The run section
- The document, the latest version and its types
- First-launch defaults
- Notes on the shape

## Product rules the document serves

- N10: "Saves carry a version number. Every change to the save format comes with an upgrade step that is tested. Losing a player's progress is the worst bug the Shell can have."
- 8.6: everything is saved on the phone only (current level state, level results, stars, daily results, statistics, settings, Premium status), after every move and every settings change, with safe writes, a kept backup that a damaged save falls back to, a version number with tested upgrade steps, and the phone's own device backup may include the file (decision D5: yes).
- S11 Data: "Reset all progress" deletes levels, stars, daily results and statistics and keeps Premium, language and settings; "Reset statistics" clears statistics.
- S14: a save from a newer app is kept untouched and the player is asked to update; a damaged save says "Your progress couldn't be loaded. A backup copy was restored." and never crashes.

## Why valibot

| Option | For | Against | Verdict |
|---|---|---|---|
| valibot 1.5.0 | modular pure functions, no `eval` or `new Function` in its dist, types inferred from the schema, `strictObject`, `variant`, MIT, no dependencies, ran in Jest and in Hermes on a Release simulator build | one more dependency | chosen, pinned exactly: `npm install -E valibot@1.5.0 -w packages/shell` |
| zod 4 | popular, similar API | its JIT compiles validators with `new Function` behind a runtime probe; Hermes behaviour in Release unverified | rejected |
| hand-written guards | no dependency | a nested document with about 60 fields means hundreds of lines to keep in sync | rejected |

`check-save-layer` reports any `zod` import (`zod-banned`).

## Sections, and what each reset clears

| Spec 8.6 item | Section | "Reset all progress" | "Reset statistics" |
|---|---|---|---|
| current level state | `run` (engine state, move log, counters) | cleared | kept |
| level results, stars | `progress.levels`, `progress.endlessBest` | cleared | kept |
| daily results | `daily` | cleared | kept |
| statistics | `stats` | cleared | cleared |
| settings and language | `settings`, `firstRun` | kept | kept |
| Premium status | `premium` | never | never |
| hint allowance, upsell line | `hints`, `upsell` | cleared | kept |
| ad caps, consent cache | `ads` | kept | kept |

## The schema files

| App path | Holds | Frozen once shipped |
|---|---|---|
| `schema/save-primitives.ts` | `COUNT`, `PERCENT`, `UINT32`, `DIFFICULTY`, `LEVEL_NUMBER`, `STARS`, `DATE_KEY`, `LEVEL_KEY`, `KEBAB_ID` | yes (a v2 adds new primitives, never edits these) |
| `schema/save-sections-v1.ts` | every section schema of v1 | yes |
| `schema/save-run-v1.ts` | `RUN_REF_V1`, `RUN_LOG_ENTRY_V1`, `RUN_V1` | yes |
| `schema/save-doc-v1.ts` | `SAVE_DOC_V1`, `SaveDocV1` | yes |
| `schema/save-doc.ts` | `LATEST_SAVE_VERSION`, `LATEST_SAVE_SCHEMA`, `SaveDoc`, `SaveSettings`, `SaveRun`, `RunRef` | no: the one place that names the latest version |
| `schema/default-save-doc.ts` | `DEFAULT_SETTINGS`, `DEFAULT_STATS`, `createDefaultSaveDoc(gameId)` | no: always the latest shape |

All live in `packages/shell/src/services/save/`.

## The primitives

```ts
export const COUNT = v.pipe(v.number(), v.safeInteger(), v.minValue(0));        // counts, ms, scores
export const PERCENT = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100));
export const UINT32 = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_294_967_295));
export const DIFFICULTY = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100));
export const LEVEL_NUMBER = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999));
export const STARS = v.picklist([1, 2, 3]);
/** Local calendar day 'YYYY-MM-DD' (ClockPort.today()). */
export const DATE_KEY = v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/));
/** Record keys are strings in JSON: level numbers as '1'..'9999'. */
export const LEVEL_KEY = v.pipe(v.string(), v.regex(/^[1-9]\d{0,3}$/));
/** kebab-case identifiers: game ids, counter ids. */
export const KEBAB_ID = v.pipe(v.string(), v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/));
```

## The sections

```ts
SETTINGS_V1 = strictObject({ language: nullable(picklist(['en','de','fa','ckb'])),  // null = System
  digits: picklist(['automatic','latin','local']), soundEnabled: boolean(), soundVolume: PERCENT,
  musicEnabled: boolean(), musicVolume: PERCENT, vibrationEnabled: boolean(),
  theme: picklist(['system','light','dark']), colorBlind: boolean(),
  reduceMotion: picklist(['system','on','off']), hintsDuringPlay: boolean() })
FIRST_RUN_V1 = strictObject({ languageChosen: boolean(), tutorialDone: boolean() })
LEVEL_RESULT_V1 = strictObject({ stars: STARS, bestScore: COUNT, bestMoves: nullable(COUNT),
  completions: COUNT, firstCompletedOn: DATE_KEY })
PROGRESS_V1 = strictObject({ levels: record(LEVEL_KEY, LEVEL_RESULT_V1), endlessBest: COUNT })
DAILY_RESULT_V1 = strictObject({ won: boolean(), score: COUNT, moves: COUNT, playMs: COUNT })
DAILY_V1 = strictObject({
  results: record(DATE_KEY, DAILY_RESULT_V1),   // the first finished attempt per day, pruned to 60 days
  completed: COUNT,                             // days ever recorded (S10 "Challenges completed")
  streak: strictObject({ lastDate: nullable(DATE_KEY), length: COUNT }),
  bestStreak: COUNT })
STATS_V1 = strictObject({ gamesPlayed: COUNT, wins: COUNT, losses: COUNT, playMs: COUNT,
  bestScore: strictObject({ level: COUNT, daily: COUNT, endless: COUNT }),
  currentWinStreak: COUNT, longestWinStreak: COUNT,
  days: record(DATE_KEY, strictObject({ games: COUNT, playMs: COUNT })),   // pruned to 14 days
  counters: record(KEBAB_ID, COUNT) })                                      // by CounterSpec.id
HINTS_V1 = strictObject({ freeDate: nullable(DATE_KEY), freeUsed: COUNT })
ADS_V1 = strictObject({
  history: strictObject({ lastInterstitialAtMs: nullable(COUNT),
    levelsCompletedSinceInterstitial: COUNT, didLastInterstitialFollowLoss: boolean() }),
  consent: strictObject({ canRequestAds: nullable(boolean()), isPrivacyOptionsRequired: boolean() }) })
PREMIUM_V1 = strictObject({ owned: boolean(), ownedSinceMs: nullable(COUNT),
  lastCheckedAtMs: nullable(COUNT), revokedAtMs: nullable(COUNT) })   // never touched by resets
UPSELL_V1 = strictObject({ lastShownOn: nullable(DATE_KEY) })
```

(Shorthand for `v.strictObject`, `v.nullable` and so on; the template file writes them out.)

## The run section

```ts
RUN_REF_V1 = variant('kind', [
  strictObject({ kind: literal('level'), level: LEVEL_NUMBER }),
  strictObject({ kind: literal('daily'), date: DATE_KEY }),      // the day the run STARTED
  strictObject({ kind: literal('endless') }),
  strictObject({ kind: literal('tutorial') }) ])
RUN_LOG_ENTRY_V1 = variant('kind', [
  strictObject({ kind: literal('move'), move: unknown() }),       // the game validates it on replay
  strictObject({ kind: literal('continue') }) ])
RUN_V1 = strictObject({ ref: RUN_REF_V1, seed: UINT32, difficulty: DIFFICULTY,
  stateVersion: pipe(COUNT, minValue(1)), state: unknown(),      // the game's own shape
  log: array(RUN_LOG_ENTRY_V1), moveCount: COUNT, undoCount: COUNT, hintsUsed: COUNT,
  continuesUsed: COUNT, playMs: COUNT,
  resumeOnLaunch: boolean() })   // true while the Game screen is open: relaunch reopens it, paused
```

The Shell validates the envelope; the game validates `state` and each `move` with its `PersistenceSpec` (`parseState`, `parseMove`, `migrateState`) when a run is restored. A run the game cannot parse or migrate is dropped alone; the rest of the save stays.

## The document, the latest version and its types

```ts
// schema/save-doc-v1.ts
/** Save document v1. FROZEN once shipped: a change means save-doc-v2.ts, a migration and new fixtures. */
export const SAVE_DOC_V1 = v.strictObject({
  schemaVersion: v.literal(1), gameId: KEBAB_ID,
  settings: SETTINGS_V1, firstRun: FIRST_RUN_V1, progress: PROGRESS_V1, run: v.nullable(RUN_V1),
  daily: DAILY_V1, stats: STATS_V1, hints: HINTS_V1, ads: ADS_V1, premium: PREMIUM_V1, upsell: UPSELL_V1,
});

// schema/save-doc.ts: the only place that names the latest version. Bump both lines together.
export const LATEST_SAVE_VERSION = 1;
export const LATEST_SAVE_SCHEMA = SAVE_DOC_V1;
export type SaveDoc = DeepReadonly<SaveDocV1>;   // reducers return new objects
export type SaveSettings = SaveDoc['settings'];
export type SaveRun = NonNullable<SaveDoc['run']>;
export type RunRef = SaveRun['ref'];
```

Code outside `schema/` imports only `save-doc.ts` types (`SaveDoc`, `SaveSettings`, `RunRef`), never a `-vN` file, so a version bump changes one file.

## First-launch defaults

`createDefaultSaveDoc(gameId)` returns the latest shape: settings `DEFAULT_SETTINGS` (language `null` = System, digits `'automatic'`, sound on at 80, music OFF at 60 so it never plays over the player's music, vibration on, theme `'system'`, colour-blind off, reduce motion `'system'`, hints during play on), both first-run flags false, empty progress (`endlessBest: 0`), `run: null`, empty daily (`completed: 0`, streak `{ lastDate: null, length: 0 }`, `bestStreak: 0`), `DEFAULT_STATS` (every count 0, `days: {}`, `counters: {}`), hints `{ freeDate: null, freeUsed: 0 }`, empty ad history with `canRequestAds: null`, Premium not owned with every date `null`, and `upsell.lastShownOn: null`. `resetStatistics` writes `DEFAULT_STATS`; `resetAllProgress` takes its sections from this function.

## Notes on the shape

- `strictObject` everywhere: an unknown key is a validation error, so a typo in a migration cannot slip through. `check-save-layer` reports `v.object`, `v.looseObject` and `v.any` in a save schema (`schema-strict`).
- `daily.completed` is a stored all-time count because `daily.results` is pruned to the last 60 days; counting result keys would stop at 60. The streak is stored incrementally for the same reason, so a 400-day streak survives pruning.
- `gameId` inside the document stops a debug-imported save of another game from loading (it decodes as damaged).
- `settings.language: null` means "System"; `digits` values are the i18n layer's names. Settings booleans keep data names (`soundEnabled`, `colorBlind`); code that destructures them renames to `is…`. Volumes are integer percent; the audio port takes 0..1, so the glue divides by 100.
- `ads.history` is the ads service's frequency history (caps survive a kill); `ads.consent` mirrors the last consent answer, so the privacy row and `canRequestAds` are known synchronously at startup.
- `premium` is the entitlement; a pending Ask-to-Buy purchase is not stored, because the store re-delivers it at launch.
- Size: the full fixture (90-level progress, 60 daily results, a 200-move log) stays in the low tens of kilobytes; the budget is a p95 write under 5 ms.
