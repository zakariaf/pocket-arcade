# E04 · Save format and migrations

| | |
|---|---|
| Branch | `epic/e04-save-and-migrations` |
| Depends on | E03 |
| Spec | N10; 8.6 Saving; 8.14 (the local error log, never a crash loop); S14 (the load outcomes behind the "damaged save, backup restored" and "newer saved data, please update" dialogs; the dialogs themselves are E15); 15.6 (a damaged save recovers from its backup, upgrades from an older save version are tested; the kill test is owed until E10); D5 (save.db sits where the phone's device backup includes it) |
| Build order | Shell step 4 |
| Tasks | 10 |

## Current state

What E01 to E03 left on `main`:

- The monorepo from E01: workspaces `apps/*` and `packages/*` (`game-kit`, `shell`, `tooling`), the pilot app folder `apps/line-siege` (its `index.ts` is still the bootstrap placeholder), `shell-slice.json` with `"screens": []`, and every gate: lefthook (pre-commit, commit-msg, pre-push), `check:fast`, `verify`, the guardrail with `quality-gates.json`, `knip.json`, and `jest.config.js`. The Jest config already holds a 95/95/95/90 coverage key for `packages/shell/src/services/save/`, which switches on by itself as soon as that folder holds a source file.
- `packages/shell` holds only the bootstrap's files: `src/config/` (app variant, ads config, game config, game extra, the phase-0 `with-shell.ts` and their tests), `src/i18n/intl-polyfills.ts` and `intl-status.ts`, `src/app-env.d.ts` and `plugins/with-app-variant-marker.ts`. There is no `src/services/` folder and no `src/app/` folder, so there is no `start-shell.ts` and no `app/test-only.ts` (E06).
- From E02, the game kit: the game contract, the seeded RNG, the dates (`packages/game-kit/src/dates/date-key.ts` with `addDays`, and `daily-seed.ts`) with their goldens, geometry, timeline, levels and solver. `fast-check` 4.10.2 is a root dev dependency.
- From E03, Line Siege's rules, bots and sims, generated packs and data goldens: `npm run test:golden` and `npm run test:sim` pass, and `node skills/game-rules-engine/scripts/check-rules-engine.mjs . --game line-siege`, `node skills/game-balance-and-bots/scripts/check-balance.mjs . --game line-siege`, `node skills/level-generation-and-solvers/scripts/check-levels.mjs . --game line-siege` and `node skills/golden-tests/scripts/check-goldens.mjs .` print `RESULT: PASS`.
- `npm run -s check:fast` is green. `npm run verify` is green up to `i18n:verify` and stops there, which is expected until E06 creates that step's target.

What does not exist yet:

- No save layer, no clock and no error log: `packages/shell/src/services/{clock,error-log,save}/` and `test/integration/save/` are missing, so `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` fails with `missing-file` lines.
- `valibot` and `expo-sqlite` are not installed anywhere.

## What we will do

Build the Shell's save layer, Shell build step 4, by copying the save-persistence-and-migrations templates test-first, in import order, so that every commit compiles and passes on its own:

- The clock and error-log ports with their fakes (the only source of wall-clock time, and the local error log of spec 8.14).
- The one versioned save document (save format v1), validated by a strict valibot schema on every load and before every write, with its first-launch defaults.
- The checksum, the save codec and the migration registry (still empty at v1), then the frozen v1 fixtures with their checksums, so the first format change after release must ship a tested upgrade (N10, 15.6).
- The pure load plan: use `current`, fall back to `backup`, start fresh only when both are damaged, quarantine bad rows instead of deleting them, and play a save from a newer app read-only without ever writing it or crashing.
- `SaveService`, the single writer: validate, then write `current` (and `backup` only when the caller asks) in one transaction; keep Premium unless a revocation date comes with the change; plus the two resets S11 needs.
- The real SQL on Node's `node:sqlite` (WAL, `synchronous = FULL`, STRICT tables, one transaction per write, quarantine, checkpoint, a `save.db` from a newer app), then the device pieces: `expo-sqlite` installed the policy way, the device SQL driver, the read-only startup peek and the SQLite error log.
- Prove Shell step 4 with its own "done when" checks, then simplify, review and merge.

Not in this epic:

- The two boot files `app/hydrate-save.ts` and `app/use-checkpoint-on-background.ts` with their tests, the boot `start-shell.ts`, and the composition root that opens `save.db` once (`createDeviceAdapters()`): E09 (Shell step 7). Until then `check-save-layer` prints five not-yet-due SKIP lines for them.
- The test-only gate `app/test-only.ts`, which decides `isStrict` at boot: E06 (Shell step 6) and E09.
- The stores that call `save.update` (`updateAndPublish`, `createTestSave`, Premium's `persistPremium`): E05. The run-end write `applyRunEnd`: E09.
- The `expo-sqlite` line in `shellPlugins`, the clean prebuild and the first Release simulator build: E10 (Shell step 8). The simulator kill test runs there for the first time; the mid-level kill flow is E16.
- The direction guard on `expo-sqlite/kv-store`: E06.
- The dialogs that show the load outcomes: the opener `load-outcome-opener.tsx` (E09) and S14's `s14-progress-restored` and "please update" dialogs (E15); the reset rows of S11 and the `s14-reset-all-progress` dialog (E14 and E15).
- The debug menu's error-log view and save export/import (S15): E15. The test-build save benchmark (`app/perf/save-benchmark.ts`): E09.
- A save format v2 (`examples/save-v2/`): only when the format first changes after v1 ships.

## Final state

- [ ] The save layer of Shell step 4 is complete: `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` prints `RESULT: PASS` with exactly five SKIP lines, all ending `due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created`: four `[missing-file]` lines (`app/hydrate-save.ts`, `app/hydrate-save.test.ts`, `app/use-checkpoint-on-background.ts`, `app/use-checkpoint-on-background.test.ts`) and one `[no-background-checkpoint]` line.
- [ ] The v1-to-v2 example was not copied: `ls packages/shell/src/services/save/migrations packages/shell/src/services/save/schema` shows no `v1-to-v2*` and no `*-v2.ts` file.
- [ ] Every save, clock and error-log test passes: `npx jest packages/shell/src/services test/integration/save --ci --selectProjects unit`.
- [ ] Both TypeScript programs are clean: `npx tsc --noEmit -p packages/shell` and `npx tsc --noEmit -p .` (the root program holds the `node:sqlite` driver and tests).
- [ ] One validated document is written in one synchronous transaction with WAL and `synchronous = FULL`, in a `current` and a `backup` slot: the `test/integration/save/sqlite-save-store.test.ts` cases "uses WAL and synchronous FULL", "reloads a document written to current and backup" and "rolls back a failed transaction" pass.
- [ ] A damaged save never loses the whole save and never crash-loops: `load-plan.test.ts` (backup restore with quarantine, fresh start only when both slots are damaged, and the added "never throws" property) and the integration case "restores the backup when current is corrupted and quarantines current" pass.
- [ ] A save from a newer app is played read-only and never written: the `load-plan.test.ts` newer-version cases and the integration case "opens a save.db from a newer app without a crash and never writes it" pass.
- [ ] Resets keep settings, language, first-run flags, ads and Premium: `reset-progress.test.ts` passes, and `check-save-layer` reports no `premium-reset`.
- [ ] The v1 fixtures are frozen at `1b56e4df` (minimal) and `11926b41` (full): `save-fixtures.test.ts` passes, and their commit carries a `Gate-Change:` trailer (`node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` prints `RESULT: PASS`).
- [ ] Dependencies follow the policy: `valibot` 1.5.0 is pinned exactly in `packages/shell` only; `expo-sqlite` `~57.0.3` sits in `apps/line-siege`, with `"expo-sqlite": "*"` in the Shell's `peerDependencies` and `"expo-sqlite": "57.0.3"` in the root `overrides`. `npm ls valibot expo-sqlite` shows one version each, and `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints `RESULT: PASS`.
- [ ] Coverage holds, including the save folder's 95/95/95/90 key: `npm run test:coverage` is green.
- [ ] Every commit was test-first and passed its hooks on its own: `node skills/tdd-workflow/scripts/check-tests.mjs .`, `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` print `RESULT: PASS`.
- [ ] `npm run -s check:fast` is green. `npm run verify` stops only at `i18n:verify` (expected red until E06), and the steps after it pass when run on their own, except `audit:network` and `audit:licenses` (expected red until E10).
- [ ] The epic's evidence report says that the simulator kill test is still owed (first Release build in E10) and passes `check-report.mjs --kind slice`.

## Skills to load

Always: `pocket-arcade-index`, `tdd-workflow`, `quality-gates`, `git-commits-and-reporting`.

For this epic:
- `save-persistence-and-migrations`: the templates this epic copies, its four references (save document, write path, migrations and fixtures, boot and kill test) and `check-save-layer.mjs`.
- `pocket-arcade-product-spec`: prints N10, 8.6, 8.7, 8.14, S14, 15 and D5 exactly (`spec-lookup.mjs`) for the first test of each task.
- `architecture-and-boundaries`: where the ports, adapters and fakes go (`examples/clock-port/`), the vendor-SDK rule for `expo-sqlite`, and `check-boundaries.mjs` and `check-layout.mjs`.
- `daily-and-statistics`: the `ClockPort` contract (`today()` as a date key from `date-key.ts`, `msUntilNextLocalDay()`), the `daily` and `stats` sections and the statistics reset rule, and `check-daily-stats.mjs`.
- `golden-tests`: the v1 save fixtures are golden paths (`**/fixtures/save-v*.json`), so their commit needs a `Gate-Change:` trailer; `check-golden-changes.mjs`.
- `dependency-management`: installs `valibot` and `expo-sqlite` with `plan-dependency.mjs` and checks them with `check-deps-policy.mjs`.
- `unit-and-component-tests`: the Jest `unit` project, fast-check properties, Node-API tests under the root `test/`, the coverage commands and `check-test-code.mjs`.
- `typescript-and-lint-rules`: the strict `tsc` programs (`packages/shell` and the root) and `check-source.mjs`.
- `naming-conventions`: file names, the path header on line 1, test titles and module constants; `check-file-names.mjs` and `check-code-names.mjs`.
- `troubleshooting-playbook`: `find-fix.mjs` for any failure, in particular `state-sqlite-in-jest`, `testing-node-api-tests` and `gates-device-only-code-without-test`.
- `game-rules-engine`: only `check-rules-engine.mjs . --game line-siege`, run once at the start to confirm E03's state (Current state); nothing in this epic changes the rules.
- `game-balance-and-bots`: only `check-balance.mjs . --game line-siege`, run once at the start for the same reason.
- `level-generation-and-solvers`: only `check-levels.mjs . --game line-siege`, run once at the start for the same reason.

## How we work in this epic

1. Branch: `git switch main && git pull && git switch -c epic/e04-save-and-migrations` (leave out `git pull` when the repo has no remote). Push the branch after each task, but only once the owner has allowed pushes (git-commits-and-reporting rule 5), and only through the pre-push hook. At this build step that hook's `npm run verify` cannot pass yet: it stops at `i18n:verify` (red until E06), and `audit:network` and `audit:licenses` stay red until E10. So the hook refuses the push. Never bypass it: keep the commits local and say so in the report.
2. Test first, always. Write each task's "Tests first" items, run them and watch them fail for the right reason, write the minimum code to pass, then refactor. Never weaken or edit a test to make it pass. Most code here comes from templates, so: copy the template's test file first; give every export it imports a typed stub that returns a wrong value; run it and keep the red assertion diff for the report (a `Cannot find module` error is not a red for the right reason); then copy the template's code and watch the test go green. Never change a template test's assertions; adding new `it` cases is fine. The first test of each task quotes its spec line, printed with `node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs <id>`, never written from memory.
3. Commit each task in Conventional Commits form, with the trailers the skills ask for (Gate-Change:, Spec-Change:). `npm run -s check:fast` must be green before every commit. Write each message to `reports/commit-message.txt` and check it with `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --message reports/commit-message.txt --staged` before `git commit -F reports/commit-message.txt`.
4. Screens: a task that builds or changes a screen is not done until the app's capture matches the Toybox design screenshot for every frame it names, in light-en, light-fa, dark-en and dark-fa at every scroll offset, and check-signoff passes for those frames. This epic builds no screen, so no task has a design match.
5. Stop and ask the owner only at a step marked **Owner**. No task in this epic has one.

## Tasks

### E04-T01 · Clock and error-log ports
- **Goal:** Give the Shell its only source of wall-clock time (`ClockPort`: `nowMs()`, `today()`, `msUntilNextLocalDay()`) and the port of its local error log (spec 8.14), each with an in-memory fake. Then the save layer and every later service can be tested without real time or a database, and the S9 "Next challenge in" countdown has its source.
- **Skills:** `save-persistence-and-migrations`, `architecture-and-boundaries`, `daily-and-statistics`, `unit-and-component-tests`.
- **Tests first:**
  - `packages/shell/src/services/clock/fake-clock.test.ts` (template): it starts at the given time and day (twelve hours before midnight by default), moves only when advanced, jumps to another day, passes local midnight into the next day, goes back a day when the phone clock is set back, and rejects a countdown longer than a day.
  - `packages/shell/src/services/clock/system-clock-adapter.test.ts` (template, with Jest fake timers so it holds in any time zone): it reads epoch milliseconds, formats today as a zero-padded `YYYY-MM-DD` key, counts down at most one local day, and keeps today until the countdown ends, then moves to the next day.
  - `packages/shell/src/services/error-log/fake-error-log.test.ts` (template): it keeps every recorded error with its source and time, and lists entries newest first with the message text.
  - Red: stub `createFakeClock`, `createSystemClockAdapter` and `createFakeErrorLog` with wrong values (for example `today: () => '2000-01-01'`, `entries: () => []`).
- **Build:** Copy from save-persistence-and-migrations `templates/packages/shell/src/services/clock/` the files `clock-port.ts`, `system-clock-adapter.ts`, `fake-clock.ts` and their two tests, and from `templates/packages/shell/src/services/error-log/` the files `error-log-port.ts`, `fake-error-log.ts` and its test. They are byte-identical, library-synced copies of architecture-and-boundaries' `examples/clock-port/` and `templates/error-log-port.ts`: never edit them. They import only `@e07/game-kit/dates/date-key.ts` (E02). `system-clock-adapter.ts` is the one file allowed to read `Date`. `sqlite-error-log-adapter.ts` waits for T08, because it needs `sql-driver.ts`. Commit: `feat(shell): add the clock and error-log ports with fakes` (body: spec 8.14 and S9's countdown).
- **Done when:**
  - `npx jest packages/shell/src/services/clock packages/shell/src/services/error-log --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p packages/shell` is clean.
  - `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .` prints `RESULT: PASS`. Its `clock-countdown` rule now finds `msUntilNextLocalDay` in the port, the adapter and the fake; the stores' daily, stats and run-end models and the two summaries print SKIP lines while `shell-slice.json` has `"screens": []`.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints `RESULT: PASS`, and `npm run -s check:fast` is green.

### E04-T02 · Save document schema v1 and first-launch defaults
- **Goal:** Define the one versioned save document of spec 8.6 and N10: every section a `v.strictObject`, `schemaVersion: v.literal(1)`, and the first-launch document. With a strict schema, a typo or a field from another version can never be read or written without notice.
- **Skills:** `save-persistence-and-migrations`, `dependency-management`, `pocket-arcade-product-spec`, `unit-and-component-tests`, `typescript-and-lint-rules`.
- **Tests first:** a new `packages/shell/src/services/save/schema/default-save-doc.test.ts`. No template ships one, and without it `check-tests` reports `untested-module` for `default-save-doc.ts`. It proves:
  - "creates a first-launch document the save schema accepts (spec 8.6)": `v.safeParse(LATEST_SAVE_SCHEMA, createDefaultSaveDoc('line-siege')).success` is true, and `schemaVersion` equals `LATEST_SAVE_VERSION` (1).
  - A pinned exact value: `DEFAULT_SETTINGS` equals the literal object `{ language: null, digits: 'automatic', soundEnabled: true, soundVolume: 80, musicEnabled: false, musicVolume: 60, vibrationEnabled: true, theme: 'system', colorBlind: false, reduceMotion: 'system', hintsDuringPlay: true }`. Music is off so the game never plays over the player's own music (spec 8.7). Premium is not owned and every Premium date is `null`; `run` is `null`; progress, daily and stats are empty.
  - "rejects an unknown key at any depth (N10)": an extra key at the top level, in `settings` and in `premium` each fails `v.safeParse`.
  - "rejects a document that claims another version": `schemaVersion: 2` fails.
  - "accepts any game state inside a saved run (spec 8.14)": a run whose `state` and `move` values are arbitrary JSON validates. The game's own parser judges them later (E09), so an unreadable run can be dropped alone.
  - A fast-check property: every settings value built from the schema's own choices (the picklists, booleans and 0-100 percents) still validates after `JSON.stringify` and `JSON.parse`.
  - Red: stub the schema and the defaults with wrong values (a too-loose and then a too-narrow schema, a default with `soundVolume: 0`) so that each case fails on an assertion. Replace every stub with the template before committing.
- **Build:**
  1. Install valibot with its first importer: `node skills/dependency-management/scripts/plan-dependency.mjs valibot --root . --online`, then run the steps it prints, in order: `npm install valibot@1.5.0 -w packages/shell`, then `npm approve-scripts --allow-scripts-pending` (it must end with `No packages with unreviewed install scripts.`).
  2. Copy from `templates/packages/shell/src/services/save/schema/`: `save-primitives.ts`, `save-sections-v1.ts`, `save-run-v1.ts`, `save-doc-v1.ts`, `save-doc.ts` and `default-save-doc.ts`. Do not copy anything from `examples/save-v2/` (the build-order manifest leaves out `schema/*-v2.ts`).
  3. Code outside `schema/` imports only the types of `save-doc.ts` (`SaveDoc`, `SaveSettings`, `SaveRun`, `RunRef`), so a later version bump changes one file.
  4. Commit: `feat(shell): add the v1 save document schema and defaults`. The body names N10 and 8.6, and records valibot 1.5.0: Shell only, MIT, no dependencies, no `eval`, older than 7 days.
- **Done when:**
  - `npx jest packages/shell/src/services/save/schema --ci --selectProjects unit` passes, and `npx tsc --noEmit -p packages/shell` is clean.
  - `npm ls valibot` shows 1.5.0 once; `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints `RESULT: PASS`; `npm run -s knip` is green.
  - `npm run test:coverage` is green. From this task on, the save folder's 95/95/95/90 coverage key is active.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints `RESULT: PASS`, and `npm run -s check:fast` is green.

### E04-T03 · Checksum, migration registry and the save codec
- **Goal:** Turn a document into a slot row and back without ever throwing. An FNV-1a checksum catches bit rot and hand edits; `decodeSlot` reads a row as `ok`, `newer` or `damaged` (with a reason); and the migration registry (`SAVE_MIGRATIONS`, empty while v1 is the only version) upgrades older rows. This is the machinery behind "every change to the save format comes with an upgrade step that is tested" (N10).
- **Skills:** `save-persistence-and-migrations`, `unit-and-component-tests`, `pocket-arcade-product-spec`.
- **Tests first:**
  - `packages/shell/src/services/save/migrations/save-migrations.test.ts` (template): exactly one step for every version below the latest, in order (none at v1); a latest document is returned unchanged; a version with no step gives `null`; steps run in order and stamp each new version; a throwing step becomes `null` (a damaged slot), never a crash.
  - `packages/shell/src/services/save/save-codec.test.ts` (template): a valid row reads back as the same document; a damaged row is named (`checksum`, `json`, a schema problem, `game-id`) and never throws; a row from a newer app is reported with its version. Added cases: "reports a document with an unknown key as damaged by the schema" (kind `damaged`, reason starting `schema`), and a fast-check property, "decodes every encoded valid document back to itself" (`decodeSlot(encodeSaveDoc(doc, meta), gameId)` gives `{ kind: 'ok', doc, migratedFrom: null }` for generated settings and counts).
  - A new `packages/shell/src/services/save/checksum.test.ts`: the pinned FNV-1a 32 test vectors (`fnv1a32('')` is `'811c9dc5'` and `fnv1a32('a')` is `'e40c292c'`), plus a property that every result is 8 lowercase hex characters.
  - Red: stub `decodeSlot` to return `{ kind: 'damaged', reason: 'missing' }`, `fnv1a32` to return `'00000000'` and `migrateToLatest` to return `null`.
- **Build:** Copy from `templates/packages/shell/src/services/save/`: `checksum.ts`, `save-store.ts` (the `SaveStore` port: `read`, `write` of both slots in one call, `quarantine`, `checkpoint`, `newerStructureVersion`; types only), `migrations/save-migrations.ts` (`SAVE_MIGRATIONS = []`, `runMigrations`, `migrateToLatest`) and `save-codec.ts` (`validateSaveDoc`, `encodeSaveDoc`, `decodeSlot`). `decodeSlot` checks in this order: newer version, checksum, JSON, migration, schema, game id. Commit: `feat(shell): encode and decode save rows with checksums and migrations` (N10, 8.6).
- **Done when:**
  - `npx jest packages/shell/src/services/save --ci --selectProjects unit` passes, and `npx tsc --noEmit -p packages/shell` is clean.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints `RESULT: PASS`, and `npm run -s check:fast` is green.

### E04-T04 · Frozen v1 save fixtures
- **Goal:** Freeze what a v1 app writes, and its checksums: the minimal fixture (the default document) and the full fixture (every section filled: a run with a move log, Premium owned, a streak, counters). Every later format change must then upgrade these exact files (15.6, "an upgrade from the previous save version is tested"; N10).
- **Skills:** `save-persistence-and-migrations`, `golden-tests`, `git-commits-and-reporting`.
- **Tests first:** `packages/shell/src/services/save/fixtures/save-fixtures.test.ts` (template). For each fixture it "keeps $name frozen" (`fnv1a32(JSON.stringify(json))` equals `FIXTURE_CHECKSUMS[name]`), "upgrades $name to a valid latest document" (`decodeSlot` gives `ok`), and "survives an encode/decode round trip for $name". Red: first write `fixture-checksums.ts` with `'00000000'` for both entries and watch the "keeps … frozen" cases fail on their assertions.
- **Build:**
  1. Copy `fixtures/save-v1.minimal.json`, `fixtures/save-v1.full.json`, `fixtures/fixture-checksums.ts` (`'save-v1.minimal': '1b56e4df'`, `'save-v1.full': '11926b41'`) and `fixtures/save-fixtures.test.ts`. The checksum covers `JSON.stringify` of the parsed file, so Prettier formatting does not change it. Never edit the values.
  2. The fixture JSON files are gated paths (`**/fixtures/save-v*.json`). The commit carries a trailer such as `Gate-Change: v1 save fixtures created (minimal and full) because the first save format ships with them; looked at every section against save-document.md`. Check the staged change first with `node skills/golden-tests/scripts/check-golden-changes.mjs . --staged --message reports/commit-message.txt`.
  3. Leave `examples/save-v2/` uncopied. It is the model for the first real v2 change ("Adding version N+1" in `references/migrations-and-fixtures.md`).
  4. Commit: `test(shell): freeze the v1 save fixtures and their checksums`.
- **Done when:**
  - `npx jest packages/shell/src/services/save/fixtures --ci --selectProjects unit` passes.
  - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` and `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD` print `RESULT: PASS`.
  - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` no longer prints any `fixture-missing`, `fixture-frozen` or `fixture-untested` line. Its remaining FAIL lines are all `missing-file`, for files that T05 to T08 add.
  - `npm run -s check:fast` is green.

### E04-T05 · The load plan
- **Goal:** Decide, without touching the disk, what a launch does with the two slots: use `current`; fall back to `backup`; start fresh only when both are damaged; quarantine bad rows instead of deleting them; and play a save from a newer app (a newer document or newer `save.db` tables) read-only, so the whole save is never lost and a launch never crash-loops (8.6, 8.14, N10). The plan is pure, because its writes must wait until after the direction check (E09). Its outcomes (`fresh`, `loaded`, `migrated`, `restored-from-backup`, `reset-after-damage`, `newer-version`) later drive S14's "progress restored" and "please update" dialogs.
- **Skills:** `save-persistence-and-migrations`, `unit-and-component-tests`, `pocket-arcade-product-spec`.
- **Tests first:** `packages/shell/src/services/save/load-plan.test.ts` (template), quoting spec 8.6 and S14 above the first case:
  - It starts fresh on first launch and writes both slots, and loads a valid `current` while refreshing the backup.
  - It restores the backup and quarantines a damaged `current`, and restores the backup without a quarantine when `current` was never written.
  - It writes nothing when the save comes from a newer app. It plays read-only when the `save.db` tables come from a newer app, whatever the rows say, and when `current` is damaged and the backup comes from a newer app.
  - It resets after both slots are damaged and keeps both bad copies, and it treats a save of another game as damaged.
  - Added: a fast-check property, "never throws and always yields a valid document for any two rows (spec 8.14)". For generated rows (random versions, payloads and checksums, each slot possibly `null`), `planLoad` returns a document that `validateSaveDoc` accepts, and an outcome of one of the six kinds.
  - Red: stub `planLoad` to return a `fresh` plan with no writes.
- **Build:** Copy `load-plan.ts` (`planLoad`, `lastWriteCount`, the `LoadOutcome`, `PlannedWrite` and `LoadPlan` types, `isReadOnly`). `lastWriteCount` keeps `write_count` rising across launches. Commit: `feat(shell): plan save loads with backup fallback and read-only mode` (8.6, 8.14, S14, N10).
- **Done when:**
  - `npx jest packages/shell/src/services/save/load-plan.test.ts --ci --selectProjects unit` passes, and `npx tsc --noEmit -p packages/shell` is clean.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints `RESULT: PASS`, and `npm run -s check:fast` is green.

### E04-T06 · SaveService, the Premium guard and the resets
- **Goal:** Have exactly one writer of the save document. It validates before every write; it writes `current` (and `backup` only when the caller passes `{ refreshBackup: true }`) in one store call; it never writes a read-only (newer) save; and it never turns Premium off without an explicit revocation date. Add the two resets S11 needs: "Reset all progress" keeps settings (and the language), first-run flags, ads and Premium; "Reset statistics" clears only the stats.
- **Skills:** `save-persistence-and-migrations`, `daily-and-statistics`, `unit-and-component-tests`.
- **Tests first:**
  - `packages/shell/src/services/save/fake-save-store.test.ts` (template): it keeps what was written, slot by slot; it fails exactly the next write when asked (a crash before COMMIT); it records quarantines, ignores checkpoints and reports a newer structure when set.
  - `packages/shell/src/services/save/save-service.test.ts` (template), proving that the service:
    - keeps the write counter rising from the highest count found at load;
    - writes only `current` unless the backup is refreshed;
    - throws on an invalid document in test builds (`isStrict`) and writes nothing;
    - logs an invalid document in store builds (area `'save'`), writes nothing and keeps the valid one;
    - keeps Premium on unless a revocation date comes with the change;
    - plays in memory and writes nothing for a save from a newer app;
    - quarantines a damaged `current` at load, restores the backup, and checkpoints on request.

    Added: a fast-check property, "never turns Premium off without a revocation date, whatever the change", over `keepPremiumUnlessRevoked` with generated owned flags and nullable dates.
  - `packages/shell/src/services/save/reset-progress.test.ts` (template, over the full v1 fixture from T04): `resetAllProgress` keeps `premium`, `settings`, `firstRun` and `ads` and clears progress, run, daily, stats, hints and upsell; `resetStatistics` clears only the stats section (`DEFAULT_STATS`).
  - Red: stub `createSaveService` with an `update` that writes nothing, and `resetAllProgress` returning its input.
- **Build:** Copy `fake-save-store.ts`, `save-service.ts` (`createSaveService`, `keepPremiumUnlessRevoked`) and `reset-progress.ts`. The backup is refreshed only at four moments, all through `refreshBackup: true` at the call site: startup (`applyLoadWrites` writes both slots), a run end (E09), a reset and a Premium change (the stores and the purchase service, E05). Per-move and per-setting writes touch `current` only. One known owner question stays open and changes nothing here: after "Reset statistics", the derived Levels and Daily cards still count from progress (daily-and-statistics `references/statistics.md`); changing that would be a save-format change. Commit: `feat(shell): add the single save writer and the progress resets` (8.6, S11, N10).
- **Done when:**
  - `npx jest packages/shell/src/services/save --ci --selectProjects unit` passes, and `npx tsc --noEmit -p packages/shell` is clean.
  - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` prints no `validate-before-write` and no `premium-reset` line. Its only FAIL lines are `missing-file` for the files T07 and T08 add.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints `RESULT: PASS`, and `npm run -s check:fast` is green.

### E04-T07 · SQLite save store on node:sqlite
- **Goal:** Prove the real SQL behind spec 8.6's "safe writes". `save.db` is opened with `journal_mode = WAL` and `synchronous = FULL` on every open, with STRICT tables. Both slots are written in one transaction, so they commit together or not at all. Bad rows are copied into `save_quarantine` (newest 10 kept), never deleted. The WAL is folded back with `wal_checkpoint(TRUNCATE)`. A `save.db` whose `user_version` is newer than `DB_STRUCTURE_VERSION` opens read-only and never throws, which prevents a crash loop after a downgrade.
- **Skills:** `save-persistence-and-migrations`, `unit-and-component-tests`, `architecture-and-boundaries`, `troubleshooting-playbook`.
- **Tests first:**
  - `packages/shell/src/services/save/sqlite-save-store.test.ts` (template, over a scripted driver with no SQL engine): it reads a row of an unknown shape as no row at all; it leaves a `save.db` whose tables come from a newer app untouched (no pragma, no DDL, `read` gives `null`, writes do nothing); and it truncates the WAL on a checkpoint and reports tables it can use.
  - `test/integration/save/sqlite-save-store.test.ts` (template, real SQL on `node:sqlite` in a fresh temporary folder per test): it uses WAL and synchronous FULL (even after the test first sets NORMAL); it reloads a document written to `current` and `backup`; it restores the backup when `current` is corrupted and quarantines `current` (reason `checksum`); it rolls back a failed transaction; it checkpoints the WAL into the main file (a PASSIVE checkpoint then reports `log: 0`); and it opens a `save.db` from a newer app without a crash and never writes it (same `user_version`, no new tables, same journal mode). Added case: "keeps only the newest 10 quarantined rows" (quarantine 12 times, then count 10 rows, the newest kept).
  - Red: stub `createSqliteSaveStore` with a store whose `read` returns `null` and whose `write` does nothing.
- **Build:**
  1. Copy `sql-driver.ts` (the `SqlDriver` port) and `save-db-schema.ts` (`SAVE_DB_FILE = 'save.db'`, `DB_STRUCTURE_VERSION = 1`, `SAVE_DB_PRAGMAS`, `SAVE_DB_DDL_V1`, `UPSERT_SLOT_SQL`, `SELECT_SLOT_SQL`, `QUARANTINE_SLOT_SQL`, `TRIM_QUARANTINE_SQL`).
  2. Copy `sqlite-save-store.ts` with its unit test.
  3. Copy `test/integration/save/node-sqlite-sql-driver.ts`, which wraps `DatabaseSync`. Its `get` copies each row (`{ ...row }`), because `node:sqlite` rows have a null prototype and `toStrictEqual` fails on them otherwise.
  4. Copy `test/integration/save/sqlite-save-store.test.ts`.
  5. Node-API code lives only under the root `test/` (troubleshooting `testing-node-api-tests`), and `expo-sqlite` never runs in Jest (`state-sqlite-in-jest`).
  6. Commit: `feat(shell): store the save document in sqlite with wal and backups` (8.6, 8.14, N10).
- **Done when:**
  - `npx jest packages/shell/src/services/save test/integration/save --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p packages/shell` and `npx tsc --noEmit -p .` are clean.
  - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` prints exactly two FAIL lines, the `missing-file` lines for `expo-sqlite-sql-driver.ts` and `peek-current-save.ts` (added in T08), and no `pragmas`, `transaction-write`, `quarantine-not-delete` or `newer-db-crash` line.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints `RESULT: PASS`, and `npm run -s check:fast` is green.

### E04-T08 · Device SQL driver, startup peek and the SQLite error log
- **Goal:** Add the pieces that run on the phone:
  - `expo-sqlite`, installed the policy way;
  - the device `SqlDriver` over expo-sqlite's synchronous API, so the boot can read the save before the first frame (`save.db` in expo-sqlite's default `Documents/SQLite` folder, which the device backup includes: D5);
  - the read-only language peek that the boot runs before the direction check;
  - the error log on the `error_log` table, which keeps the newest 200 rows, never throws and never leaves the device (8.14, N2).
- **Skills:** `dependency-management`, `save-persistence-and-migrations`, `architecture-and-boundaries`, `troubleshooting-playbook`.
- **Tests first:**
  - `test/integration/save/sqlite-error-log-adapter.test.ts` (template, `node:sqlite`): it lists recorded errors newest first with their source and time, keeps only the newest 200 rows, and swallows errors before the tables exist (never throws). Red: stub `createSqliteErrorLogAdapter` with `entries: () => []`.
  - The two device files have no Jest test by design. Each carries its `// device-only: covered by …` line in its first lines: `expo-sqlite-sql-driver.ts` is covered by the simulator kill test, and `peek-current-save.ts` by the RTL language-switch flow. `check-tests` and `check-test-edits` accept that marker (troubleshooting `gates-device-only-code-without-test`), and `check-save-layer`'s `peek-writes` rule proves the peek runs no `.run`, `.exec` or `.transaction`.
- **Build:**
  1. `node skills/dependency-management/scripts/plan-dependency.mjs expo-sqlite --root . --online`, then its printed steps in order:
     1. Add `"expo-sqlite": "*"` to `packages/shell/package.json` `peerDependencies` and `"expo-sqlite": "57.0.3"` to the root `overrides`.
     2. Run `(cd apps/line-siege && npx expo install expo-sqlite@~57.0.3)`.
     3. Run `npm approve-scripts --allow-scripts-pending`.
     4. Run `(cd apps/line-siege && npx expo install --check && npx expo-doctor)`.
     5. The plan's last step, a clean prebuild and `npm run build:ios:sim`, is owed until E10, where `build:ios:sim` and the `'expo-sqlite'` line of `shellPlugins` arrive. Say so in the report.
  2. Copy `packages/shell/src/services/save/expo-sqlite-sql-driver.ts`, `packages/shell/src/services/save/peek-current-save.ts`, `packages/shell/src/services/error-log/sqlite-error-log-adapter.ts` and `test/integration/save/sqlite-error-log-adapter.test.ts`.
  3. No module opens the database when it is imported. `createDeviceAdapters()` opens it once, after the direction check (E09).
  4. Commit: `feat(shell): add the device sqlite driver, startup peek and error log` (8.14, D5, N2). The body records expo-sqlite `~57.0.3`, the Shell peer, the root override and the checks run.
- **Done when:**
  - `npx jest packages/shell/src/services test/integration/save --ci --selectProjects unit` passes.
  - `npx tsc --noEmit -p packages/shell` and `npx tsc --noEmit -p .` are clean.
  - `npm ls expo-sqlite` shows 57.0.3 once; `node skills/dependency-management/scripts/check-deps-policy.mjs .` prints `RESULT: PASS`; `npm run -s knip` is green (if it names `peek-current-save.ts` or `expo-sqlite-sql-driver.ts` as unused before their E09 importers exist, follow the knip note in T09).
  - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` prints `RESULT: PASS`, with only the five step-7 SKIP lines named in T09.
  - `node skills/tdd-workflow/scripts/check-tests.mjs .` prints `RESULT: PASS`, and `npm run -s check:fast` is green.

### E04-T09 · Prove Shell step 4
- **Goal:** Show with the build order's own "done when" checks that Shell step 4 is complete and that every step commit stood on its own, and record what is still owed: the simulator kill test, which needs the first Release build (E10).
- **Skills:** `save-persistence-and-migrations`, `pocket-arcade-index`, `quality-gates`, `architecture-and-boundaries`, `daily-and-statistics`, `naming-conventions`, `typescript-and-lint-rules`, `unit-and-component-tests`, `git-commits-and-reporting`.
- **Tests first:** No new behaviour, so no new test. If a check below fails on product code, the fix starts with a test that shows the problem, seen red (tdd-workflow), and is committed as its own `fix(shell):` slice.
- **Build:** Run the checks below and collect their output in `reports/` for the epic report. For the record, the kill test that E10 will run is `node skills/save-persistence-and-migrations/scripts/kill-test.mjs --create --app <path to the Release test-variant LineSiege.app> --bundle-id io.applander.linesiege --game-id line-siege --repo .`. Do not run it now: there is no build yet.
- **Done when:**
  - `node skills/save-persistence-and-migrations/scripts/check-save-layer.mjs .` prints `RESULT: PASS` with exactly these five SKIP lines, each ending `due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created`: `[missing-file]` for `app/hydrate-save.ts`, `app/hydrate-save.test.ts`, `app/use-checkpoint-on-background.ts` and `app/use-checkpoint-on-background.test.ts`, and `[no-background-checkpoint]` for `app/use-checkpoint-on-background.ts`.
  - `npx jest packages/shell/src/services test/integration/save --ci --selectProjects unit` passes.
  - `npx jest packages/shell/src/services/save test/integration/save --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/services/save/**/*.ts' --coverageThreshold='{}'` shows the save folder at or above 95 % statements, lines and functions and 90 % branches, and `npm run test:coverage` is green.
  - `npx tsc --noEmit -p packages/shell` and `npx tsc --noEmit -p .` are clean.
  - These print `RESULT: PASS`:
    - `node skills/architecture-and-boundaries/scripts/check-boundaries.mjs .`
    - `node skills/architecture-and-boundaries/scripts/check-layout.mjs .`
    - `node skills/daily-and-statistics/scripts/check-daily-stats.mjs .`
    - `node skills/naming-conventions/scripts/check-file-names.mjs .`
    - `node skills/naming-conventions/scripts/check-code-names.mjs .`
    - `node skills/typescript-and-lint-rules/scripts/check-source.mjs .`
    - `node skills/unit-and-component-tests/scripts/check-test-code.mjs .`
    - `node skills/tdd-workflow/scripts/check-tests.mjs .`
  - The step commits on its own: `git log --oneline main..HEAD` shows the commits of T01 to T08 (plus any `fix(shell):` slice from this task), each of which passed the pre-commit typecheck. These also print `RESULT: PASS`:
    - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD`
    - `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD`
    - `node skills/git-commits-and-reporting/scripts/check-commits.mjs . --range main..HEAD`
  - `npm run -s check:fast` is green. If `npm run -s knip` names a step-4 file as unused, do not add an ignore entry: report it as a build-order gap (quality-gates `references/fixing-failures.md`).
  - The kill test is listed as owed (E10) in the epic report's "Not tested or not verified".

### E04-T10 · Simplify, code review, re-run the gates and merge
- **Goal:** Apply owner rule 4 to the whole branch, so the save layer reaches E05 simpler and reviewed, without breaking a frozen contract.
- **Skills:** `tdd-workflow`, `quality-gates`, `golden-tests`, `save-persistence-and-migrations`, `git-commits-and-reporting`.
- **Tests first:** Every confirmed finding that changes behaviour gets a failing test that shows the problem first, seen red, then the fix. Never edit a frozen fixture, a checksum, a `-v1` schema file or a template test's assertion to satisfy a review. If a reviewer finds a real defect in the v1 shape, stop and send the owner a stop-and-ask note: it is a gated contract that later work shares (the parity fixture save in `frames.json` is written in v1 terms).
- **Build:** Follow "Close the epic" below. The library-synced files (the clock files, `error-log-port.ts`, `fake-error-log.ts` and its test) stay byte-identical to the library. A simplification there is reported as a change for the skill library, never made in the app.
- **Done when:**
  - Every T09 "Done when" command passes again after the fixes.
  - `npm run test:coverage` is green.
  - `node skills/tdd-workflow/scripts/check-test-edits.mjs . --range main..HEAD` and `node skills/golden-tests/scripts/check-golden-changes.mjs . --range main..HEAD` print `RESULT: PASS`.
  - The evidence report passes `check-report.mjs --kind slice`, and the branch is merged.

## Close the epic
1. Re-run every task's "Done when" and `npm run verify`; all green. At Shell step 4, `verify` is green up to `i18n:verify` and stops there (expected red until E06; quality-gates, "When verify is green"). Run the steps after it on their own, and expect them green: `npm run -s knip`, `node packages/tooling/src/quality/check-quality-gates.ts`, `npm run test:coverage`, `npm run test:sim` and `node packages/tooling/src/deps/check-deps.ts`. `audit:network` and `audit:licenses` stay expected red until E10. Any other red step is a real failure.
2. Run `/simplify` over the branch's changes (`git diff main...HEAD`). Apply its fixes; where behaviour changes, test first. Then run `npm run verify` again.
3. Run `/code-review` on the branch. Fix every confirmed finding test-first (a failing test that shows the problem, then the fix). Then run `npm run verify` again.
4. Write the epic's evidence report (git-commits-and-reporting, slice form) from `templates/evidence-slice.md` to `reports/evidence-<YYYY-MM-DD>-e04-save-and-migrations.md`. Its first line is the outcome in plain words (progress is now saved safely, with a backup, and older saves can be upgraded). The Evidence line names `shell`. "Not tested or not verified" lists the simulator kill test (E10), the two device-only files (proven only on a device), and the dialogs that show the load outcomes (E09 and E15). Check it with `node skills/git-commits-and-reporting/scripts/check-report.mjs reports/evidence-<YYYY-MM-DD>-e04-save-and-migrations.md --kind slice`.
5. Merge: `git switch main && git merge --no-ff epic/e04-save-and-migrations && git push origin main`, then delete the branch (`git branch -d epic/e04-save-and-migrations`). The push needs the owner's go-ahead and passes through the pre-push `npm run verify`, which cannot be green before E10 (step 1). Never bypass the hook: if it refuses, keep `main` local and say so in the report.
