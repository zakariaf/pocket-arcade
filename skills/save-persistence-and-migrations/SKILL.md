---
name: save-persistence-and-migrations
description: Builds and checks the save layer - valibot save document, sync expo-sqlite writes, WAL, current/backup slots, load plan, quarantine, migrations with frozen fixtures, node:sqlite tests, boot hydration, kill test. Use when saved data, its format or its loading changes. Not for stores (state-stores).
---

# Save persistence and migrations

Everything the player owns is one versioned JSON document, validated on every load and before every write, committed to SQLite in one synchronous transaction, kept twice (current and backup), and upgraded only by tested migrations; scripts prove the code, the fixtures and the file on a simulator.

## Rules that must hold

1. **One save document, one writer.** Everything persisted lives in `save_slots('current'|'backup')` of `save.db` and is written only by `SaveService.update(recipe, { refreshBackup })`; no AsyncStorage, MMKV, SecureStore or Zustand persist, and SQLite is imported only inside `services/save` and `services/error-log`. One document means one version number and pure migrations.
2. **Validate with the strict valibot schema on every load and before every write.** An invalid document is never written: test builds throw, store builds log and skip. N10: losing a player's progress is the worst bug the Shell can have, so a bug must fail loudly in tests and never reach disk.
3. **Open SQLite with `journal_mode = WAL` and `synchronous = FULL`, write through the synchronous API in one transaction, and refresh `backup` only at startup, at a run end, after a reset and after a Premium change.** A committed transaction survives a kill or power loss; per-move writes touching only `current` can never spoil the last good backup.
4. **Never lose the whole save, and never crash-loop on it.** A damaged `current` falls back to `backup`; only when both are damaged does the app start fresh; bad rows are quarantined, never deleted; a run the game cannot parse is dropped alone; a save from a newer app (a newer document or newer `save.db` tables) is played in memory and never written, and opening it never throws.
5. **Change the format only through a new schema version, one pure frozen `vK-to-vK+1` step, and new frozen fixtures with checksums.** Never edit a shipped `save-doc-vN.ts`, section file, fixture or checksum, and commit the change with a `Gate-Change:` trailer. Old saves on real phones must keep upgrading exactly as tested.
6. **Premium never turns off without an explicit revocation date, and never in a reset.** `keepPremiumUnlessRevoked` guards every writer; "Reset all progress" keeps settings, language, first-run flags, ads and Premium.
7. **At boot, write nothing before the direction check; the language peek is read-only; hydrate synchronously before the first render.** Module code runs again after a direction reload, so an early write would happen twice.
8. **Checkpoint the WAL (`wal_checkpoint(TRUNCATE)`) when the app goes to the background.** The device backup then copies one self-contained `save.db`.
9. **Test the real SQL on `node:sqlite` through `SqlDriver`, and finish every change to the write path or boot with the simulator kill test.** Jest proves the SQL; only a real kill proves the app.

## Workflow

1. Read [references/save-document.md](references/save-document.md) (the v1 shape, sections, resets, defaults) and [references/write-path.md](references/write-path.md) (tables, drivers, codec, load plan, SaveService, backup moments, checker rules).
2. New Shell, in two parts that follow the Shell build order. **At Shell step 4** copy everything under `templates/` except the two boot files: `packages/shell/src/services/save/` (drivers, stores, codec, load plan, `SaveService`, resets, the startup peek, schema v1, migrations, fixtures and their tests), `services/clock/` and `services/error-log/` (ports, adapters, fakes and tests) and `test/integration/save/` (the `node:sqlite` driver and the SQL tests). Install `npm install -E valibot@1.5.0 -w packages/shell` (a Shell-only dependency) and `npx expo install expo-sqlite` inside every `apps/<game>` (it writes `~57.0.3`), plus `"expo-sqlite": "*"` in `packages/shell/package.json` `peerDependencies` (the dependency-management rules). The clock and error-log files are identical copies in every skill that ships them (an older `clock-port.ts` without `msUntilNextLocalDay` is replaced). `game-kit/src/dates/date-key.ts` and `app/test-only.ts` must exist (daily and architecture work; architecture-and-boundaries ships `test-only.ts` with the shared test-only pair, which holds only `TEST_BUILD_SENTINEL` at this step, so `test-only.ts` compiles). **At Shell step 7** (the boot, with `start-shell.ts`, together with the composition root, because each imports step-7 code or is imported by it) copy `packages/shell/src/app/hydrate-save.ts` and `use-checkpoint-on-background.ts` with their tests: they need `@react-navigation/native`, RNTL, state-stores' `testing/create-test-save.ts` and the test-only pair's members, which arrive at steps 6 and 7. Until `packages/shell/src/app/start-shell.ts` exists, `check-save-layer.mjs` prints `SKIP` lines for them (a pass); from then on a missing one is a `missing-file` problem. The composition root that calls `hydrateSave` and mounts `useCheckpointOnBackground(save)` once is game-host-integration's template (`app/create-shell-parts.ts`, `app/shell-app.tsx`); this skill ships no `create-shell-app.tsx`.
3. A service or store needs to save something: add it to the document (step 4 if the shape changes), then call `save.update((doc) => ({ ...doc, section }), { refreshBackup })` with `refreshBackup: true` only for a run end, reset or Premium change. Never touch SQL.
4. The stored shape changes: read [references/migrations-and-fixtures.md](references/migrations-and-fixtures.md) and follow "Adding version N+1" in order, imitating `examples/save-v2/` (schema v2, step, step test with a fast-check property, default doc, fixtures, checksums). A new version is permanent for players once shipped: name it in the report to the owner.
5. Boot or kill-test work: read [references/boot-and-kill-test.md](references/boot-and-kill-test.md) (boot order, peek, `hydrateSave`, `resumeState`, SQL tests, kill test).
6. Run the tests: `npx jest packages/shell/src/services/save packages/shell/src/app/hydrate-save.test.ts packages/shell/src/app/use-checkpoint-on-background.test.ts test/integration/save --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/services/save/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds) and `npx tsc -p packages/shell --noEmit` (plus `npx tsc -p .` for the root `test/` program).
7. When the write path, the schema or the boot changed and a Release test-variant simulator build exists: `node ${CLAUDE_SKILL_DIR}/scripts/kill-test.mjs --create --app <App.app> --bundle-id <id> --game-id <game-id> --repo .` must print `RESULT: PASS`; inspect any save.db with `node ${CLAUDE_SKILL_DIR}/scripts/inspect-save.mjs`. Without a build, say in the report that the kill test is still owed.
8. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-save-layer.mjs .` from the repo root; fix every `FAIL` line and rerun until it prints `RESULT: PASS`.

## Definition of done

- [ ] Only `SaveService` writes save rows; SQLite appears only in `services/save`, `services/error-log`, `test/` and tooling.
- [ ] Every save schema uses `v.strictObject`; `LATEST_SAVE_VERSION` and `LATEST_SAVE_SCHEMA` name the highest `save-doc-vN.ts`.
- [ ] Every version above 1 has its step, its registration, its step test and both frozen fixtures with checksums; no shipped file was edited.
- [ ] `load-plan`, `save-service`, `reset-progress`, `save-migrations`, `save-fixtures`, `hydrate-save`, `use-checkpoint-on-background` and `test/integration/save` tests pass; `tsc` is clean. The device-only files (`expo-sqlite-sql-driver.ts`, `peek-current-save.ts`) carry their `// device-only:` line.
- [ ] Resets keep settings, first-run flags, ads and Premium, and refresh the backup.
- [ ] A `save.db` whose `user_version` is newer than `DB_STRUCTURE_VERSION` opens read-only with the `newer-version` outcome; the integration test proves nothing is written.
- [ ] After a write-path, schema or boot change: the kill test printed `RESULT: PASS`, or the report says it is owed.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-save-layer.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **"Just add a field" to `save-sections-v1.ts` after v1 shipped.** Every existing save then fails validation and falls back or resets; make v2 with a migration.
- **Editing a fixture or checksum to make a test pass.** The fixture is what old phones hold; fix the code, or add a new version.
- **A migration that imports `createDefaultSaveDoc` or reads `Date`.** Tomorrow's defaults would change yesterday's upgrade; write literal values.
- **Writing the backup on every move.** One bad write sequence would then overwrite the last good copy; refresh it only at the four moments.
- **Deleting a damaged row "to clean up".** Quarantine it: it is the only evidence, and the debug export needs it.
- **`await`-ing an async SQLite call before the first render, or opening the database at module load.** Use the synchronous API in the composition root (`createDeviceAdapters()` opens it once, after the direction check).
- **A second store (AsyncStorage, MMKV) "for a small flag".** Add a field to the document instead; a side store has no version and no backup.
- **Turning Premium off because a restore returned nothing.** Only an explicit revocation date may turn it off.
- **`throw` in `createSqliteSaveStore` for a newer `user_version`.** Every launch after a downgrade then crashes before the first frame (a crash loop the player cannot escape); return the read-only store and let the load plan show "please update".
- **Opening the app's `save.db` in place from the host.** Copy it first (`inspect-save` does); opening it can checkpoint or lock the live file.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/save-document.md](references/save-document.md) | Product rules, valibot choice, sections and resets, every v1 schema, defaults, notes on the shape | Workflow step 1 |
| [references/write-path.md](references/write-path.md) | Tables and pragmas, drivers, SaveStore, codec, load plan and outcomes, SaveService, backup moments, resets, checkpoint, error log, checker rules | Workflow steps 1 and 3 |
| [references/migrations-and-fixtures.md](references/migrations-and-fixtures.md) | Migration rules, runner, adding version N+1 step by step, writing a step, frozen fixtures, tests per version | Workflow step 4 |
| [references/boot-and-kill-test.md](references/boot-and-kill-test.md) | Boot sequence, peek, hydrateSave, composition root, clock adapter, SQL tests, kill test, inspect-save, verified facts | Workflow steps 5 and 7 |
| `templates/packages/shell/src/services/save/` | Driver port and drivers, SaveStore (SQLite and fake), SQL, checksum, codec, load plan, SaveService, resets, peek, schema v1, migrations, fixtures, and their tests | Workflow step 2 |
| `templates/packages/shell/src/services/clock/` | `clock-port.ts`, `system-clock-adapter.ts` (the one file that reads `Date`), `fake-clock.ts` and their tests, synced from the library (do not edit here) | Workflow step 2 |
| `templates/packages/shell/src/services/error-log/` | `sqlite-error-log-adapter.ts` (newest 200 rows), plus `error-log-port.ts`, `fake-error-log.ts` and its test synced from the library | Workflow step 2 |
| `templates/packages/shell/src/app/` | `hydrate-save.ts` (`hydrateSave` over an injected `SaveStore`, `resumeState`), `use-checkpoint-on-background.ts`, and their tests | Workflow steps 2 and 5 |
| `templates/test/integration/save/` | `node:sqlite` driver and the SQL integration tests | Workflow steps 2 and 6 |
| `examples/save-v2/` | A complete v1-to-v2 change (schema, step, step test, defaults, fixtures, checksums) | Workflow step 4 |
| `scripts/check-save-layer.mjs` | Static checker for the save layer, schemas, migration chain, fixture checksums and the newer-`save.db` boot path | Workflow step 8, and at the end |
| `scripts/inspect-save.mjs` | Health check of a save.db, a .sql dump, or the simulator app's file | Workflow step 7, and when a save looks wrong |
| `scripts/kill-test.mjs` | Simulator kill test: launch, SIGKILL at growing delays, inspect | Workflow step 7 |
| `scripts/lib/save-db.mjs` | Stages a copy of save.db and judges its health (used by both scripts above) | Never by hand |
| `scripts/lib/app-modules.mjs` | Imports the app's TypeScript modules for `inspect-save --deep` | Never by hand |
| `scripts/lib/fixture-tree.mjs` | Builds the self-test trees (templates plus one planted bug) | Never by hand |
| `scripts/selftest.mjs` | Proves check-save-layer and inspect-save pass good input and catch every planted bug | After changing a checker or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in (check-lib, the clock and error log files) | When adding a shared file |
| `tests/fixtures/` | Planted-bug overlays for check-save-layer (with `support/`, the start-shell.ts stand-in that makes the boot files due) and SQL dumps for inspect-save | When adding a checker rule |

## Related skills

- `state-stores` - the stores that call `save.update` and publish after it.
- `daily-and-statistics` - the daily and stats sections and the run-end recipe.
- `settings-and-preferences` - the settings section, its defaults and rows.
- `premium-purchase` - the Premium section and `persistPremium`.
- `rtl-and-direction` - the direction check and the key-value guard that run before hydration.
- `ios-simulator-build` - the Release test-variant build the kill test installs.
- `e2e-maestro` - the mid-level kill flow.
- `golden-tests` - the Gate-Change trailer policy for frozen files.
