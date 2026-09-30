# State, saving and navigation

Failures with the save file, SQLite, stores, the navigator and the direction reload. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Save file
- Navigation
- Stats
- Daily

## Save file

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `state-zod-jit` | zod crashes or refuses to run on Hermes in Release | zod 4's JIT uses new Function | Use valibot 1.5.0 for the save document | verified | `save-persistence-and-migrations` |
| `state-sqlite-in-jest` | expo-sqlite fails in Jest | The native module does not run in Jest | Keep SQL behind a SqlDriver; test the real DDL on node:sqlite in root test/integration; the simulator kill test is the final check | verified | `save-persistence-and-migrations` |
| `state-newer-db-crash` | App crashes at boot after installing an older TestFlight build (save.db from a newer app) | An older createSqliteSaveStore threw when PRAGMA user_version was newer than DB_STRUCTURE_VERSION, so every launch crashed before the first frame | Use the current save-persistence-and-migrations templates: the SQLite store returns a read-only store with newerStructureVersion(), hydrateSave passes it to planLoad, and the session plays in memory with the newer-version outcome ("please update"); check-save-layer reports a throw as newer-db-crash | verified | `save-persistence-and-migrations` |
| `state-both-slots-damaged` | Both save slots are unreadable | The spec defines only "a backup copy was restored" | Quarantine the rows, start fresh, show "Your progress couldn't be loaded." (needs a catalog key and translations) | open | `save-persistence-and-migrations` |
| `state-wal-checkpoint` | A device backup restores an older save | Data sits in save.db-wal | Run PRAGMA wal_checkpoint(TRUNCATE) when the app goes to the background (verified: -wal drops to 0 bytes) | verified | `save-persistence-and-migrations` |
| `state-save-payload-size` | Save writes get slow as the document grows | The whole JSON document is written on every save | Keep the perf test at p95 < 5 ms; past about 200 KB move the active run into its own row | documented | `save-persistence-and-migrations` |
| `state-save-db-not-a-database` | App crashes at boot with "file is not a database" | save.db itself is not an SQLite file (never seen with WAL and synchronous = FULL) | Not handled yet: moving save.db aside and starting fresh needs a file API and the owner's approval; send the owner the error and the file size | open | `save-persistence-and-migrations` |

## Navigation

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `state-prevent-remove-limits` | Progress lost although Back opens Pause | usePreventRemove does not catch app close, an OS kill, or screens unmounted by a groups.if flip | Save after every move; Back-opens-Pause is UX only | verified | `navigation-and-routing` |
| `state-rtl-push-direction` | Push animations may slide the wrong way in RTL with headerShown false | Not checked visually (the source says native-stack passes direction) | Owner RTL play-test confirms pushes slide from the reading direction | open | `navigation-and-routing` |
| `state-reduce-motion-fade` | Reduce motion on, screens still slide | The static navigator always uses the platform push animation | Set animation: 'fade' from the reduce-motion setting (screen options or setOptions); not designed yet | open | `navigation-and-routing` |
| `state-nav-direction-source` | Navigator direction disagrees with layout for one launch | Direction was derived from the language setting, not I18nManager | Derive direction from I18nManager.getConstants().isRTL (NavigationContainer default) | verified | `navigation-and-routing` |
| `state-back-on-game-untested` | Back on the Game screen was checked only by tsc and source reading | No runtime test yet | Add an RNTL test with the real navigator: goBack shows Pause, again resumes, Pause -> Home saves | open | `navigation-and-routing` |
| `state-continue-hardcoded` | Continue is offered in a game whose config disables it | The composition root hard-coded isContinueAllowed: true | Read it from the game config; check-host reports continue-from-config | verified | `game-host-integration` |

## Stats

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `state-reset-statistics-scope` | After Reset statistics, level and daily cards still show numbers | They are derived from progress and daily results | Owner decides whether Reset statistics needs its own baselines | open, owner | `daily-and-statistics` |
| `state-stale-stores-after-run` | Home and S10 show old stars and statistics until the app restarts | The run end was written with a bare save.update(applyRunEnd …), so the section stores never re-read the document | updateAndPublish(save, stores, { recipe, refreshBackup: true }); check-stores cross-section-write and the game-host check report a bare write | verified | `state-stores` |

## Daily

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `state-daily-loss-counts` | A lost daily attempt still extends the streak | The first finished attempt counts | If the owner wants wins only, change recordDailyResult's caller, not the model | open, owner | `daily-and-statistics` |
| `state-countdown-utc` | "Next challenge in {h} h {m} min" is hours off (it counts to UTC midnight) | It was computed in a screen from nowMs() % 86_400_000 | Read useNextDayCountdown() (ClockPort.msUntilNextLocalDay(), DST-safe in the system adapter); check-daily-stats reports day-maths-in-ui | verified | `daily-and-statistics` |
| `state-week-numbered-by-weekday` | E2E or parity cannot find daily.week-day.7 or stats.week-bar.7 for today | The strip was numbered by ISO weekday instead of position | Number by position (1 = six days ago, 7 = today); the weekday only picks the letter and name | verified | `daily-and-statistics` |
| `state-summary-view-name-clash` | Two daily-view (or stats-view) files in one folder; imports pick the wrong one | The pure summary was named daily-view.ts next to the DailyView component daily-view.tsx | The pure summaries are daily-summary.ts and stats-summary.ts (useDailySummary, useStatsSummary) | verified | `daily-and-statistics` |
| `state-daily-salt-shared` | Two games' daily levels follow the same seed sequence | A game copied the template's daily salt 0x5446 | Use the FNV-1a salt the scaffold prints for the game id; check-levels reports daily-salt-shared | verified | `level-generation-and-solvers` |
