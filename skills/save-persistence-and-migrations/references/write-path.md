# SQLite, the load plan and the single writer

How the document gets into `save.db` and back: tables and pragmas, the two drivers, the `SaveStore` port, the checksum and codec, the pure load plan, the one writer (`SaveService`), resets, the WAL checkpoint and the error log. Every file named here is a template in this skill.

## Contents

- Where the file lives
- Tables and pragmas
- Two version numbers
- The SQL driver port and its two drivers
- The SaveStore port, the SQLite store and the fake
- Checksum and codec
- The load plan (pure)
- What the player sees for each outcome
- The single writer: SaveService
- Write path and backup path
- Resets
- WAL checkpoint on background
- The error log
- What check-save-layer reports

## Where the file lives

`<app container>/Documents/SQLite/save.db` (plus `-wal` and `-shm`), expo-sqlite's default directory, which the device backup includes (decision D5). The language direction guard lives in `expo-sqlite/kv-store`'s own database, not in `save.db`, through `services/save/sqlite-kv-direction-guard-adapter.ts` (the RTL work owns it). The only other key-value use is test-only: e2e-maestro's `services/save/sqlite-kv-debug-store-adapter.ts` keeps the debug flags (`debug.overrides`, `debug.pending-screen`) across a direction reload or a kill, and is reached only through `TEST_ONLY`, so store builds never contain it. Nothing else may use the key-value store: player data goes into the save document.

## Tables and pragmas

```ts
// services/save/save-db-schema.ts
export const SAVE_DB_FILE = 'save.db';
export const DB_STRUCTURE_VERSION = 1;          // PRAGMA user_version, NOT the document schemaVersion
export const SAVE_DB_PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
`;                                             // run on every open: synchronous is per connection
export const SAVE_DB_DDL_V1 = `
CREATE TABLE IF NOT EXISTS save_slots (
  slot TEXT PRIMARY KEY NOT NULL CHECK (slot IN ('current', 'backup')),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  app_version TEXT NOT NULL, written_at INTEGER NOT NULL, write_count INTEGER NOT NULL,
  checksum TEXT NOT NULL, payload TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS save_quarantine (
  id INTEGER PRIMARY KEY AUTOINCREMENT, quarantined_at INTEGER NOT NULL, slot TEXT NOT NULL,
  reason TEXT NOT NULL, schema_version INTEGER, payload TEXT) STRICT;
CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at_ms INTEGER NOT NULL, area TEXT NOT NULL,
  message TEXT NOT NULL, details TEXT) STRICT;
PRAGMA user_version = 1;`;
```

Plus `UPSERT_SLOT_SQL` (`INSERT ... ON CONFLICT (slot) DO UPDATE SET ...`), `SELECT_SLOT_SQL`, `QUARANTINE_SLOT_SQL` (copies a slot row into `save_quarantine`) and `TRIM_QUARANTINE_SQL` (keeps the newest 10).

- WAL plus `synchronous = FULL`: a committed transaction survives a kill or a power loss. This is the "write the new copy, then swap" safe write of spec 8.6; SQLite's journal does it for us.
- STRICT tables need SQLite 3.37 or newer (expo-sqlite 57 bundles 3.50.3; Node 26.4 ships 3.53.2).
- `write_count` rises across launches (diagnostics and the kill test); `checksum` is FNV-1a 32 of `payload` and catches bit rot or a hand-edited file that is still valid JSON.
- A test-build performance log table (`perf_log`) may live in the same file; it is not part of the save document, its migrations or any reset.

## Two version numbers

`PRAGMA user_version` versions the tables and almost never changes; a table change adds `SAVE_DB_DDL_V2`, applied when `user_version = 1`, then bumps it. `schema_version` versions the JSON document and changes with features (migrations file).

A `user_version` newer than the app means an older build was installed over a newer one (a TestFlight downgrade). The tables may have a different shape, so the app must not read, migrate or write them, and it must not crash either (spec 8.14: never a crash loop). `createSqliteSaveStore` therefore reads `user_version` first and, when it is newer, returns a store that touches nothing (no pragma, no DDL; `read` gives null, `write`, `quarantine` and `checkpoint` do nothing) and reports `newerStructureVersion()`. `hydrateSave` passes that to `planLoad` as `newerStructure`, which gives the same read-only `newer-version` outcome as a newer document: the session plays the default document in memory and the "please update" dialog shows at every launch. The integration test `opens a save.db from a newer app without a crash and never writes it` proves the file keeps its `user_version`, gets no tables and keeps its journal mode. `check-save-layer` reports a `throw` in the SQLite store or a boot that ignores the newer structure (`newer-db-crash`).

A file that is not a database at all (`file is not a database` on the first statement) is not handled yet: it would still throw at boot. It has never been seen with WAL plus `synchronous = FULL`; if it ever is, the fix is to move `save.db` aside and start fresh (troubleshooting catalogue `state-save-db-not-a-database`).

## The SQL driver port and its two drivers

```ts
// services/save/sql-driver.ts
export type SqlValue = string | number | null;            // no blobs, no booleans (store 0/1)
export type SqlRow = Readonly<Record<string, unknown>>;
export type SqlDriver = {
  readonly exec: (sql: string) => void;                  // DDL and PRAGMAs, several statements
  readonly run: (sql: string, params: readonly SqlValue[]) => void;
  readonly get: (sql: string, params: readonly SqlValue[]) => SqlRow | null;
  readonly transaction: (work: () => void) => void;      // BEGIN; work(); COMMIT; ROLLBACK + rethrow
};
export type ClosableSqlDriver = SqlDriver & { readonly close: () => void };
```

- Device: `expo-sqlite-sql-driver.ts` wraps `openDatabaseSync(fileName)` with `execSync`, `runSync`, `getFirstSync` and `withTransactionSync` (BEGIN, task, COMMIT, and ROLLBACK plus rethrow on an exception). The synchronous API is what lets the boot hydrate before the first frame and lets `update` return only after the commit.
- Tests and tooling: `test/integration/save/node-sqlite-sql-driver.ts` wraps Node's built-in `node:sqlite` `DatabaseSync` (no flag, no warning on Node 26, works inside jest-expo's environment). It lives under the root `test/` because only the root tsconfig has Node types. Its `get` copies the row (`{ ...row }`): `node:sqlite` rows have a null prototype, and `toStrictEqual` fails on them otherwise.

## The SaveStore port, the SQLite store and the fake

```ts
// services/save/save-store.ts
export type SlotName = 'current' | 'backup';
export type SlotRecord = { schemaVersion; appVersion; writtenAtMs; writeCount; checksum; payload };
export type SaveStore = {
  read: (slot: SlotName) => SlotRecord | null;
  write: (slots: { current?: SlotRecord; backup?: SlotRecord }) => void;   // ONE transaction
  quarantine: (slot: SlotName, reason: string, atMs: number) => void;     // copy, keep newest 10
  checkpoint: () => void;                                                  // wal_checkpoint(TRUNCATE)
  newerStructureVersion: () => number | null;  // user_version of a save.db from a newer app, else null
};
```

- `sqlite-save-store.ts`: on creation reads `user_version`; a newer structure gets the read-only store above; otherwise it runs the pragmas and creates the tables on a fresh file. `write` upserts both slots inside `driver.transaction`, so `current` and `backup` commit together or not at all. Bad rows are copied to `save_quarantine`, never deleted (`DELETE FROM save_slots` is reported by the checker).
- `fake-save-store.ts`: two slots in a `Map`, records quarantines, `failNextWrite = true` throws once to simulate a crash before COMMIT, and `newerStructure = <n>` simulates a save.db from a newer app. Store and screen tests use it; SQL tests use the Node driver.

## Checksum and codec

```ts
// checksum.ts: FNV-1a 32 over UTF-16 code units, 8 lowercase hex chars
export function fnv1a32(text: string): string { /* 0x811c9dc5, xor, Math.imul(h, 0x01000193), >>> 0 */ }

// save-codec.ts
type DecodeResult =
  | { kind: 'ok'; doc: SaveDoc; migratedFrom: number | null }
  | { kind: 'newer'; version: number }
  | { kind: 'damaged'; reason: string };
validateSaveDoc(doc: unknown): { doc: SaveDoc } | { error: string }   // first issue as "path: message"
encodeSaveDoc(doc, { appVersion, writtenAtMs, writeCount }): SlotRecord  // JSON.stringify + fnv1a32
decodeSlot(record, gameId): DecodeResult   // never throws, never writes
```

`decodeSlot` order: a row version above `LATEST_SAVE_VERSION` is `newer`; a checksum mismatch is `damaged: 'checksum'`; unparsable JSON is `damaged: 'json'`; an older version runs `migrateToLatest` (null means `damaged`); the latest schema validates (`damaged: 'schema <path>: <message>'`); a different `gameId` is `damaged: 'game-id'`.

## The load plan (pure)

Reading is pure: both rows go in; a document, an outcome and a list of planned writes come out. The writes run later, after the direction check, because module code runs again after a direction reload.

```ts
planLoad({ current, backup, gameId, newerStructure? }): LoadPlan
// LoadPlan = { doc, outcome, writes: ({ kind: 'quarantine', slot, reason } | { kind: 'write-both' })[], isReadOnly }
lastWriteCount(input) // max(current.writeCount, backup.writeCount): the counter keeps rising
```

0. `newerStructure` is a number (the tables come from a newer app): read-only, outcome `newer-version` with `found` = that `user_version`; the rows are not even read.
1. `current` decodes: use it; write both slots (this refreshes the backup), outcome `loaded` or `migrated`.
2. `current` (or else `backup`) is `newer`: play the default document in memory, write nothing, `isReadOnly: true`, outcome `newer-version`.
3. `current` is damaged or missing and `backup` decodes: quarantine `current` (if it existed), write both slots from the backup, outcome `restored-from-backup`.
4. Both damaged: quarantine whichever rows exist, start fresh, write both, outcome `reset-after-damage`. Both missing: `fresh`.

## What the player sees for each outcome

| Outcome | S14 dialog | Writes |
|---|---|---|
| `fresh` | nothing | both slots |
| `loaded` | nothing | both slots (refreshes `backup`) |
| `migrated` | nothing | both slots, now the latest version |
| `restored-from-backup` | "Your progress couldn't be loaded. A backup copy was restored." | quarantine `current`, then both slots from backup |
| `reset-after-damage` | "Your progress couldn't be loaded." (needs its own copy key; the spec only defines the backup text) | quarantine both, then fresh |
| `newer-version` | "A new version of the saved data was found… please update", at every launch (a newer document or newer tables) | none: the session plays in memory and saves nothing |

## The single writer: SaveService

```ts
createSaveService(deps: { store, clock, errorLog, appVersion, isStrict }, plan, writeCountBase): SaveService
// doc(): the latest document in memory
// update(recipe, { refreshBackup? }): doc = keepPremiumUnlessRevoked(doc, recipe(doc));
//   unless read-only: validateSaveDoc -> encodeSaveDoc -> store.write({ current (, backup) })
// applyLoadWrites(): runs the plan's quarantines and write-both
// checkpoint(): store.checkpoint()     isReadOnly(): plan.isReadOnly
```

- Every write is a synchronous transaction. When `update` returns, the change is committed (WAL plus FULL), so the next line may animate, navigate or finish a store transaction.
- An invalid document is never written. In test builds (`isStrict`, `TEST_ONLY !== null`) it throws, so Jest, end-to-end runs and the kill test surface the bug; in store builds it is logged (`'save'`), not written, and the next valid write repairs the disk.
- `keepPremiumUnlessRevoked`: a change from owned to not owned without `revokedAtMs` is undone, for every writer. The purchase flow's revocation writes `owned: false` with the transaction's revocation date.
- Nothing else writes: stores, the ads service and the purchase service all call `save.update`. `check-save-layer` reports a `store.write` or `UPSERT_SLOT_SQL` outside `services/save` (`write-outside-service`; the one exception is the test-build save benchmark `app/perf/save-benchmark.ts`, which times raw writes into its own scratch `perf-bench.db`) and SQLite imports outside the save layer (`sqlite-outside-save`).

## Write path and backup path

```
store.dispatch(action)
  -> reducer (pure)                                    new section
  -> SaveService.update(recipe, { refreshBackup })     whole new document
      -> keepPremiumUnlessRevoked                      Premium guard
      -> validateSaveDoc (valibot)                     invalid: log (+ throw in test builds), no write
      -> encodeSaveDoc: JSON.stringify + fnv1a32
      -> SaveStore.write: BEGIN; UPSERT current (+ backup); COMMIT
  -> store.set(next)                                   the UI updates
```

The backup is refreshed from a validated document at exactly these moments: at startup (`applyLoadWrites` after a successful load or migration), at every run end, after a reset, and after a Premium change. Per-move and per-setting writes touch `current` only, so a bad write sequence in the middle of a level can never overwrite the last good backup.

## Resets

```ts
resetAllProgress(doc)   // progress, run, daily, stats, hints, upsell from createDefaultSaveDoc;
                        // KEEPS settings (and language), firstRun, ads and premium
resetStatistics(doc)    // the stats section only
```

Both are written with `refreshBackup: true`, so a later backup restore cannot undo a reset: "Reset statistics" is the stats store's `reset-statistics` action (its own section), and "Reset all progress" is one cross-section write (`updateAndPublish` with `resetAllProgress`) after which every section store re-reads the document. `check-save-layer` reports a reset that writes `premium` (`premium-reset`). The test decodes the full fixture, resets it, and asserts `premium`, `settings`, `firstRun` and `ads` are unchanged.

## WAL checkpoint on background

`useCheckpointOnBackground(save)` listens to `AppState` and calls `save.checkpoint()` (`PRAGMA wal_checkpoint(TRUNCATE)`) when the app goes to the background, so a device backup taken while the app is suspended holds one self-contained `save.db` (verified: `save.db-wal` went from 4-16 KB to 0 bytes). The game host's own background handler saves the paused run first; the checkpoint only folds what is already committed. Call the hook once in the Shell's root component (`ShellApp` in `app/shell-app.tsx`); `check-save-layer` reports a missing listener, and a hook that `shell-app.tsx` never calls (`no-background-checkpoint`).

## The error log

`sqlite-error-log-adapter.ts` implements the error log port (`error-log-port.ts`, shipped with its fake `fake-error-log.ts`) on the `error_log` table: `record(source, error)` inserts and trims to the newest 200 rows and never throws; `entries()` returns the newest rows for the debug menu, or none when the table is missing or unreadable (a save.db from a newer app). Nothing leaves the device (N2). On a first launch the table exists only after the save DDL ran, so the composition root logs boot problems after `hydrateSave`.

## What check-save-layer reports

| Rule | Means |
|---|---|
| `missing-file` | a file of the standard save layer is missing |
| `sqlite-outside-save` | `expo-sqlite` or `node:sqlite` imported outside `services/save`, `services/error-log`, `test/` or tooling |
| `second-persistence` | AsyncStorage, MMKV, SecureStore or `zustand/middleware` imported |
| `zod-banned` | `zod` imported |
| `pragmas` | no WAL, no `synchronous = FULL`, or tables not STRICT |
| `transaction-write` | a `write` that runs SQL outside `driver.transaction`, or no `wal_checkpoint(TRUNCATE)` |
| `quarantine-not-delete` | a `DELETE FROM save_slots` |
| `validate-before-write` | the writer does not validate first, lacks the Premium guard, or ignores `isReadOnly` |
| `schema-strict` | `v.object`, `v.looseObject` or `v.any` in a save schema |
| `schema-version` | `save-doc-vN.ts` without `schemaVersion: v.literal(N)`, or `LATEST_*` not the highest N |
| `migration-chain` | a missing `vK-to-vK+1.ts`, its registration in `SAVE_MIGRATIONS` or its test |
| `migration-pure` | a migration imports runtime code or today's schema, or reads time or randomness |
| `fixture-missing` | `save-vN.minimal.json`, `save-vN.full.json` or its checksum entry is missing |
| `fixture-frozen` | a fixture no longer matches its recorded `fnv1a32` |
| `fixture-untested` | `save-fixtures.test.ts` does not run a fixture |
| `write-outside-service` | a save row written outside `services/save` |
| `premium-reset` | `reset-progress.ts` touches `premium` |
| `peek-writes` | `peek-current-save.ts` runs a statement that writes |
| `no-background-checkpoint` | nothing checkpoints the WAL when the app goes to the background, or the hook exists but is never called |
| `newer-db-crash` | the SQLite store throws while opening `save.db`, lacks `newerStructureVersion`, or `hydrateSave` / `planLoad` ignore it |
