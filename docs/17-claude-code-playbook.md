# 17 · Claude Code playbook

> **What this doc decides.** How a Claude Code session works in this repo, from the first command to the report the owner reads: the session-start ritual, the definition of done with the evidence each kind of change needs, the build order for the Shell and for every game, the bootstrap and new-game checklists, when to stop and ask, the commit conventions, how to report in plain language, and the `AGENTS.md` (plus its one-line `CLAUDE.md`) that puts all of this in front of every session.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) D.41 (TDD loop and build order), D.42 (hooks and gate changes), E (human steps), F (canonical names). This doc collects rules that the topic docs own and points to them; it adds no new technical decision.
> **Related docs:** [00-README.md](00-README.md) (index and reading orders), [07-testing-and-tdd.md](07-testing-and-tdd.md) (TDD loop, evidence report), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (scripts, hooks, gates), [03-naming.md](03-naming.md) (commit format), [14-ios-build-and-release.md](14-ios-build-and-release.md) (human steps, release stops), [02-architecture-and-folders.md](02-architecture-and-folders.md) (add a game), [08-game-engine.md](08-game-engine.md) (building a game).

---

## 1. The session-start ritual

Run it at the start of every session, including short ones. It takes a minute and prevents the two expensive mistakes: building on a red tree and building on stale assumptions.

1. **Work from the repository root.** Claude Code loads `.claude/settings.json` (hooks and permissions) only from the directory the session starts in (docs/16 rule 4).
2. **Know the state of the tree.** `git status`, `git log --oneline -10`, and the current branch. Work in progress that you did not make is never discarded, stashed or reset; ask about it.
3. **Start from green.** `npm run -s check:fast`. If it fails, getting back to green is the first task, and the report says what was broken.
4. **Check the toolchain when you will build or install:** `node --version` (26.4.0), `npm --version` (11.17.0), and `xcodebuild -version` through `DEVELOPER_DIR` (Xcode 26.6, docs/14 section 3.2). Run `npm ci` when `package-lock.json` changed since the last session.
5. **Check dated items** (docs/01 sections 3.4 and 3.5):

   | Date | Item | Action |
   |---|---|---|
   | on or after 2026-10-03 | the bootstrap `min-release-age-exclude` block in `.npmrc` expires | delete the whole block (never extend it); `verify` fails from 2026-10-04 until it is gone |
   | 2026-10-28 | Node 26 becomes LTS | move to the newest 26.x LTS that is at least 7 days old, with a full verify run |
   | mid or late October 2026 | Expo SDK 58 expected to go stable | move only when the SDK 58 trigger in docs/01 section 3.5 is met, all apps together |
   | monthly | dependency pass | docs/01 section 3.4 |

6. **Read the owner doc of the area you will touch** ([00-README.md](00-README.md) section 5): its Rules, its Checklist and its Open issues. If its Verified date is more than a few weeks old, run its *Re-verify* commands before trusting a version. Never write code against a library API from memory (docs/01 rule 13).
7. **Name the spec lines the task serves** (for example "spec S9, 8.3"). Quote them in the first test's title or a comment.
8. **Plan the smallest behaviour slice** and write its failing test (section 2 and docs/07 section 3.7).

At the end of a session: the Stop hook runs `check:fast`; commit the finished slices; write the report (section 7). The Stop hook allows 8 consecutive continuations; if it still fails after that, report the failing gate instead of working around it (docs/16 section 6).

---

## 2. Definition of done

A task is done only when every line that applies is true and the evidence is in the report.

**Always:**
- Every new behaviour has a test that was run and seen failing for the right reason (an assertion, not an import or type error) before the code was written, and the test and code are in the same commit (docs/07 rules 1 to 3).
- `npm run -s check:fast` is green. Before any push, `npm run verify` is green (the pre-push hook runs it).
- The Checklist of every owner doc you touched was run.
- If behaviour, names, paths or versions changed, the owner doc was updated in the same commit (its rules, code blocks and *Verified* section), and no other doc still contradicts it.
- No gate was weakened, no hook bypassed, no `eslint-disable`, `@ts-ignore`, `.skip` or `.only` added (docs/16 section 11).
- The report (section 7) is written with numbers taken from the files in `reports/`, never from memory.

**Evidence by kind of change:**

| Change | Evidence required |
|---|---|
| Pure logic (rules, levels, reducers, policies, game-kit) | example tests + fast-check properties + one pinned golden value (docs/07 rule 15); coverage at or above the gates; for a finished rules module or policy, a Stryker run with survivors explained |
| Levels, daily challenge, board drawing | data or pixel goldens created or changed only on purpose, each PNG opened with the Read tool, `Gate-Change:` trailer (docs/07 rule 18); daily goldens for existing dates never change |
| Save format | new schema version, pure migration, frozen `save-vN.*.json` fixtures, migration test and property, `node:sqlite` tests, then the simulator kill test (docs/06 sections 6.11 to 6.13) |
| UI (screens, components) | RNTL tests through `renderWithShell` (docs/07 section 3.8.7), `findInaccessiblePressables` clean (docs/15); simulator screenshots of each changed screen in at least `en` and `fa`, light and dark, opened with the Read tool; before a release, the full matrix |
| Navigation, flows, first run, restart for direction | the Maestro flows that cover them pass on a Release simulator build of the test variant with `ADS_MODE=off` (docs/07 section 3.11) |
| Native modules, config plugins, `app.config.ts`, `withShell` | `npx expo config --json` for every allowed variant pair, a clean prebuild, `npm run build:ios:sim`, a launch screenshot looked at, `npm run audit:privacy` and `npm run audit:network` (docs/14, docs/13) |
| A new dependency | exact version, at least 7 days old (or a dated exclude, docs/01 section 3.4), all apps in lockstep, install script reviewed, licence allowed, `knip` clean, `audit:network` clean |
| Ads or Premium | fake-based tests for every affected spec 8.8 rule or S12 state (each numeric limit at exactly its value); Premium changes also the Tier-2 StoreKit harness (docs/12 section 3.8) |
| Anything that reaches players (a release) | docs/14 section 3.13 release checklist, `e2e:ios` and `screenshots:ios` green on this commit, mutation score at or above 75%, the owner's play-test and VoiceOver check |

---

## 3. Build orders

The order comes from FINAL D.41: each layer is tested before anything depends on it.

### 3.1 The Shell with the pilot game (Line Siege)

1. **Bootstrap** the empty repo with its gates (section 4.1).
2. **game-kit and the contract:** `GameModule` types, `Result`, PRNG, dates and daily seed, geometry, timeline (docs/02 section 7, docs/08 sections 2.3 to 2.13, docs/06 section 8.1).
3. **Line Siege rules** with examples and properties, then its bot and sims, then its level generator, solver and data goldens (docs/08 section 3 steps 1 to 4, docs/07 sections 3.8.1 to 3.8.4).
4. **Save format and migrations:** the save document, SQL on `node:sqlite`, load plan, save service, fixtures (docs/06 section 6).
5. **Services behind ports with fakes:** clock, error log, connectivity, then audio and haptics, ads and consent, purchase (docs/02 section 6, docs/09, docs/11, docs/12).
6. **Boot:** Intl polyfills, direction check, hydration at splash, stores, the navigator (docs/10 section 3.10, docs/06 sections 3, 4 and 7).
7. **Hooks and UI primitives:** theme, `AppText`, buttons, icons, error boundaries (docs/05); the game host, board canvas, gestures and lifecycle (docs/08 sections 2.5 to 2.15).
8. **Screens S1 to S15** with RNTL tests, in spec order (docs/06 section 3.1 lists the routes).
9. **Maestro flows, the debug deep link, the network guard, the screenshot matrix** (docs/07 sections 3.11 to 3.13, docs/13 layer F).
10. **Audits and the release pipeline:** `audit:network`, `audit:privacy`, `audit:licenses`, the store-artifact gate, then a test build to TestFlight (docs/13, docs/14).
11. **The new-game scaffold** (`npm run new-game`, docs/02 section 11.3), so game 2 starts from a script, not from memory.

Spec section 15 (definition of done for the Shell and pilot) is the exit test: every item there must have its evidence in the release report.

### 3.2 Every game

1. **Classify the game** (turn-based, simulate-then-replay or real-time), its input mode and input policy (docs/08 sections 3 and 4).
2. **State, moves and events** in `apps/<id>/src/rules/<id>-types.ts`; then `create`, `listMoves`, `applyMove`, `outcome`, `intentToMove`, test-first with properties (docs/08 section 3 steps 2 and 3, docs/07 section 3.8.1).
3. **Bot and sims:** winnability, difficulty curve, termination (docs/08 step 4, docs/07 section 3.8.4).
4. **Level generator, solver and par, pack layout, daily difficulty**, with data goldens (docs/02 section 7.2 `levels.ts`, docs/07 section 3.8.2).
5. **Persistence:** `parseState`, `parseMove`, the JSON round trip, the save policy (and save points for real-time games) (docs/02 section 7.2 `persistence.ts` and `realtime.ts`).
6. **Board:** view, timeline, palette tokens, paths, layout, draw, draw-call budget, pixel goldens at three sizes, the board object; real-time games also the sim (docs/08 section 3 steps 5 to 11, docs/09 section 7.2).
7. **Teaching, statistics and texts:** tutorial script, 3 to 5 how-to-play pages, 2 to 4 counters, all four catalogs with game-id-prefixed keys (docs/02 section 7.2, docs/10 section 3.16).
8. **Art and sounds:** `drawIcon`, `render-art.ts`, the sound bank and its recipe tests, `credits.json` (docs/09 sections 5, 7 and 9).
9. **Assemble** `src/index.ts` as `ShellGameModule<Types>`; the contract tests of docs/02 section 7.5 pass.
10. **The game's own E2E flows** (numbered 10 and up, including one real board tap) and the screenshot baselines (docs/07 sections 3.11 and 3.13).
11. **Release:** once the owner's per-game steps are done (section 4.2), `release:ios --variant test`, the owner's play-test, then the store build (docs/14 section 3.8).

---

## 4. Checklists

### 4.1 Bootstrap an empty repo (first Shell session only)

- [ ] Toolchain as in docs/14 section 3.1: Xcode 26.6 selected through `DEVELOPER_DIR` (never `xcode-select`), mise with Node 26.4.0 and Ruby 3.2.2, CocoaPods 1.17.0, Java 17. Steps that need `sudo` or a password are the owner's (O4).
- [ ] `git init` at the repo root; `docs/` and `spec.txt` committed as they are.
- [ ] Root files, each copied from its owner doc: `package.json` (docs/02 section 4.1, scripts from docs/16 section 1), `.npmrc` (docs/01 section 3.4), `.nvmrc` and `.mise.toml` (docs/14 section 3.1), `.gitignore` (docs/16 section 4), `tsconfig.base.json` and `tsconfig.json` (docs/04 section 2.2), `.prettierrc.json` and `.prettierignore` (docs/04 section 4), `eslint.config.mjs` (docs/04 section 3, complete as printed), `babel.config.js`, `jest.config.js`, `jest.setup.ts`, `jest.sim.config.js`, `stryker.config.json`, `tsconfig.stryker.json` and root `__mocks__/` (docs/07 sections 3.3 to 3.6 and 3.10, docs/09 section 4.6), `knip.json`, `lefthook.yml`, `quality-gates.json` and `.claude/settings.json` (docs/16 sections 4 to 8), `AGENTS.md` and `CLAUDE.md` (sections 8 and 9 below).
- [ ] Workspaces `packages/game-kit`, `packages/shell`, `packages/tooling`, each with its `package.json` and `tsconfig.json` (docs/02 sections 4.2 and 4.3, docs/04 section 2.2), and `packages/shell/src/app-env.d.ts` (docs/04 section 2.2).
- [ ] The pilot app `apps/line-siege` from the Expo SDK 57 template: remove `expo-router`, `react-dom`, `react-native-web` and the template's route files (docs/01 ADR-01 and ADR-04, section 3.2); move the template's `.claude/settings.json` to the root and merge it (docs/16 section 6); replace the template's `AGENTS.md` (it says "Use Expo Router") with section 8; then `package.json` (docs/02 section 4.4, including `expo-system-ui`), `app.config.ts`, `game.config.ts`, `index.ts` (docs/02 section 8), `metro.config.js` (docs/14 section 3.5), `tsconfig.json` (docs/04 section 2.2) and `assets/fonts/` (docs/10 section 3.13).
- [ ] Install at the exact versions of docs/01 section 3.2 with the commands of section 3.3 (`npx expo install` inside the app for Expo-managed packages, `npm install -E` otherwise), approve the install scripts (docs/16 section 9.2), commit `package-lock.json`.
- [ ] The tooling gate scripts that the configs call: `quality/check-quality-gates.ts` and `gate-diff.ts`, `deps/check-deps.ts`, `deps/app-lockstep.ts`, `deps/release-age-excludes.ts`, `deps/banned-packages.ts`, `clock/system-clock.ts`, `git/check-commit-message.ts` and `commit-message-rules.ts`, `hooks/after-edit.ts` (docs/16, docs/03 section 14, docs/01 sections 3.4 and 3.6).
- [ ] `npx lefthook validate`; `npm run -s check:fast` and `npm run verify` green on the skeleton.
- [ ] First commit, for example `chore(repo): scaffold the monorepo and its gates`, with a `Gate-Change: initial quality gates` trailer (the commit stages gated files).

### 4.2 New game

**Before code (owner and agent together):**
- [ ] The owner picked the game (spec section 13, decision D1 for the pilot) and approved its design notes: modes, pack layout, star rule (par or score), difficulty bands for the sims.
- [ ] The owner approved the app name and bundle ID (G1); the ID matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`.
- [ ] `npm run new-game -- --app <game-id>` created `apps/<game-id>/` (docs/02 section 11.3); `game.config.ts` is filled, with placeholder AdMob IDs until the owner supplies real ones; `npx expo config --json` passes for `test/test`, `test/off` and `store/off`.

**Build (section 3.2), then:**
- [ ] Contract tests pass (docs/02 section 7.5); coverage of `apps/<game-id>/src/rules` at 95/95/95/90; Stryker on the rules at or above 75% with survivors explained.
- [ ] Sims show a winnable game and a difficulty curve inside the approved bands; every shipped level is proven solvable (spec 15 item 7).
- [ ] `npm run i18n:verify` passes; the fa and ckb texts are marked for the native-speaker review (docs/10 section 3.16).
- [ ] `render-art.ts --app <game-id> --check` passes; the icons were looked at in 1024 and 256 px (docs/09 section 7.4).
- [ ] The game's E2E flows and the Shell's flows pass with this game; screenshot baselines created with `--update`, every PNG opened with the Read tool, committed with `Gate-Change:`.
- [ ] `npm run audit:network` and, after a prebuild, `npm run audit:privacy` pass.

**Owner's per-game steps (ask for them in one message, section 7):**
- [ ] G2 app record in App Store Connect; G3 App Privacy questionnaire (docs/13 section 3.4); G4 and P1 Premium price point and Family Sharing, then `create-premium-iap.ts` (docs/12 section 3.10); G5 and A2 to A4 AdMob app, 3 units, consent message, blocking controls (docs/11 section 3.11); real IDs written into `game.config.ts`.
- [ ] `npm run release:ios -- --app <game-id> --variant test`; G6 the owner's TestFlight play-test with the Tier-3 purchase test; G7 native-speaker review; then the store build and R1 to R6 (docs/14 section 3.11).

---

## 5. Stop and ask

Stopping is not failing. For each case below, stop that line of work, send the owner one message (section 7), and continue with other work if there is any.

| Situation | What to do | Source |
|---|---|---|
| A human step is needed (O1 to O10, G1 to G8, R1 to R6, A1 to A6, P1) | name the step ID and the one action needed; never simulate or skip it | docs/14 section 3.11, docs/11 section 3.11, docs/12 section 3.11 |
| A gate looks wrong or blocks you: a lint rule, a limit, a threshold, a tolerance, a baseline, an audit finding | do not edit the gate; send the note of docs/16 section 11 step 6 (gate, file and line, message, why it looks wrong, smallest change); edits to gate files prompt the owner anyway | docs/16 rule 7 and section 11 |
| A change would touch a path in `gatedPaths` (quality gates, goldens, baselines, fixtures, `.npmrc`, network baselines) other than by an intended, explained change | ask; an agreed change goes in one commit with a `Gate-Change:` trailer | docs/03 rule 16, docs/16 section 5 |
| The spec is contradicted, ambiguous or silent about something a player would see | quote the spec lines, give the options with your default, record it in the owner doc's Open issues; never trade away N1 to N12 | spec section 3 |
| Two docs disagree | follow the owner doc (00-README section 5), fix the other doc in the same commit, mention it in the report | 00-README section 1 |
| Irreversible or outward-facing actions: an App Store Connect upload (`release:ios`), submitting for review, creating or changing App Store Connect records (Premium product, age rating, tester groups), turning on Family Sharing, pushing branches or tags, force-pushing or rewriting pushed history, deleting files, data or simulators you did not create, sending anything to a third party | ask first, unless the owner asked for exactly this action in this session; submit for review only after the owner's "submit" | docs/14 rules 12 to 14, R5 |
| Release stops: `errSecInternalComponent`, any agreement error, a missing app record, HTTP 401 or 403 from Apple, processing `INVALID` | stop, do not retry, do not switch signing methods; one message with the step and the exact error line | docs/14 rule 12, section 3.12 |
| Anything that would read, print, copy, move or commit the `.p8` key, a JWT or a password | never; if a task seems to need it, ask | docs/13 section 3.5, docs/14 rule 9 |
| A new dependency outside the documented procedure, a banned package, a held-back major, an early release-age exception | ask, unless the owner doc's procedure covers it exactly | docs/01 sections 3.4 to 3.6 |
| An open owner decision becomes blocking (00-README section 6) | use the documented default and say so; ask when the default no longer works | 00-README section 6 |
| The Stop hook still fails after its 8 continuations | report the failing gate and what you tried | docs/16 section 6 |

---

## 6. Commit conventions

docs/03 section 13 owns the format and the `commit-msg` hook enforces it (docs/16 section 5). In short:

- **Header:** `<type>(<scope>): <subject>`, at most 72 characters, imperative, lowercase start, no trailing period. Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`. Scope: a folder under `apps/` or `packages/` (`line-siege`, `shell`, `game-kit`, `tooling`), or `repo`, `deps`, `docs`, `ci`.
- **Body:** why the change was made, with the spec lines it serves.
- **Trailers** (last paragraph): `Gate-Change: <reason>` when a staged file is in `gatedPaths`; `Spec-Change: <spec section and what changed>` when an existing test expectation changed because the spec changed (never for "the test was wrong"); any `Co-Authored-By:` line the session instructions ask for.
- **Slices:** one behaviour per commit, red and green together, docs updated in the same commit. Never `--no-verify` (the deny rules block it). Never amend or rebase commits that were pushed.
- **Release commits and tags** come from `npm run release:ios` only: `chore(<game-id>): build <n>`, then the tags `<game-id>/vX.Y.Z+<build>` after an upload and `<game-id>/vX.Y.Z` when the owner says "ship" (docs/14 section 3.8). Tags are never moved or reused.

Example:

```text
feat(line-siege): clear full columns and fire a beam

Spec 13 (Line Siege) and 8.13: a full column clears and damages the
first monster in that column. Examples, a determinism property and a
golden for daily 2026-09-26 cover it.

Gate-Change: new data golden for the daily level of 2026-09-26
```

---

## 7. Reporting to the owner

The owner reads plain English, not logs. Every report follows these rules:

1. **Lead with the outcome in one sentence, in players' words:** "Line Siege now saves after every move: killing the app reopens the same board, paused."
2. **Name things the way the spec does:** screens by name and ID (Home, S4), features by section (daily challenge, 8.3).
3. **Numbers come from `reports/`**, never from memory; say which report.
4. **At most one request per message**, phrased so it can be answered in a word, with the default that applies until then: "Please create the App Store Connect app record for Flock Tilt (step G2, about 2 minutes). Until then I keep working on the board."
5. **Point at no more than five things to look at**, and say where (gallery row, screenshot file, TestFlight build).
6. **Be honest about limits:** list what was not verified (sound, haptics and 120 Hz need a phone; purchases need TestFlight).
7. **Keep technical detail out of the first lines.** Stack traces, commands and file lists go after a "Details" line or into the commit messages.

For every finished slice and every release, use the evidence template of docs/07 section 3.17 (short form for a slice, full form for a release). For a release, also open the screenshot gallery for the owner and list the manual checks (TestFlight purchase, VoiceOver, play-test sign-off).

---

## 8. The `AGENTS.md` template

Copy this to the repo root as `AGENTS.md` when bootstrapping (section 4.1). It replaces the Expo template's `AGENTS.md`. Keep it short: it points to the docs rather than repeating them. When a rule here changes, change the owner doc in the same commit.

````markdown
# AGENTS.md

This repository holds the E07 game framework ("the Shell") and its games, one Expo app per game.
Claude Code writes, tests and releases all of it. The owner reviews, play-tests and does the
steps that need a person. No human reads the code line by line, so the checks do that job.

## Sources of truth
- `spec.txt`: what the Shell and the games do. Its non-negotiables N1 to N12 never bend.
- `docs/00-README.md`: the handbook index, reading orders, and which doc owns which topic.
- `docs/99-final-decisions.md`: the binding decisions every doc cites as FINAL-DECISIONS.
- `docs/17-claude-code-playbook.md`: how a session works here.
- When two docs disagree, the owner doc named in `docs/00-README.md` wins; report the disagreement.
- Versions come from `docs/01-stack-and-versions.md` section 3.2, and library APIs from their
  versioned docs, never from memory: npm already carries majors this project must not use.

## At the start of every session
1. Work from the repository root: hooks and permissions load only there.
2. Run `git status` and `git log --oneline -10`. Never discard work you did not make.
3. Run `npm run -s check:fast`. If it is red, getting back to green is the first task.
4. Read the owner doc of the area you touch: its Rules, Checklist and Open issues.
5. Check the dated items in `docs/17-claude-code-playbook.md` section 1.

## How to work
- Test first. Write one failing test, run it, read the failure, write the minimum code, refactor,
  run `npm run -s check:fast`, commit test and code together. The tests are the owner's evidence.
- Build in the documented order: `docs/17-claude-code-playbook.md` section 3.
- Keep game rules, levels and `packages/game-kit` pure and deterministic: no React, Skia, clock,
  `Math.random` or transcendental `Math`. Daily challenges and replays must match on every phone.
- Save before animating, and change the save format only through a new version, a tested
  migration and frozen fixtures. Losing progress is the worst bug the Shell can have (N10).
- Our app code makes no network requests (N3): no `fetch`, no URLs, no new network-capable SDK.
  Only AdMob and the store purchase SDK go online, behind their adapters.
- Every visible string is one catalog message in en, de, fa and ckb (N12), and layout uses
  start/end, never left/right (N11). Check fa screenshots, not only en.
- Put vendor SDKs behind their port (`docs/02-architecture-and-folders.md` section 6); tests use fakes.
- Let the React Compiler memoise: no `useMemo`, `useCallback` or `memo` without a measurement.
  Reanimated shared values use `.get()` and `.set()`.
- Put each file where `docs/02-architecture-and-folders.md` section 10 says, named as in
  `docs/03-naming.md`, with its repo path as the first line.
- Look at every screenshot and golden you create with the Read tool before committing it.
- Update the owner doc in the same commit when behaviour, names, paths or versions change.

## Commands
- `npm run -s check:fast`: format, lint, types, related tests (also the Stop hook).
- `npm run verify`: every gate except E2E and mutation (also the pre-push hook).
- `npm test`, `npm run test:golden`, `npm run test:sim`, `npm run test:coverage`, `npm run test:mutation`.
- `npm run i18n:verify`, `npm run knip`, `npm run audit:network`, `npm run audit:privacy`, `npm run audit:licenses`.
- `npm run build:ios:sim -- --app <game-id>`, `npm run e2e:ios -- --app <game-id>`,
  `npm run screenshots:ios -- --app <game-id>`, `npm run release:ios -- --app <game-id> --variant test|store`.
- `npm run new-game -- --app <game-id>`.

## Things this project does not use, and why
- Expo Router: the Shell owns one React Navigation static stack (`docs/06`).
- EAS, `expo-updates`, OTA updates, `expo-dev-client`: no cloud builds and no network from the app.
  The Expo Claude Code plugin offers EAS and cloud skills; do not use them.
- Hand edits to `ios/` or `android/`: they are generated by prebuild; change `app.config.ts`
  and config plugins instead.
- `eslint-disable`, `@ts-ignore`, `.skip`, `.only`, `--no-verify`, lowered thresholds:
  when a gate fails, fix the code; if the gate looks wrong, ask.
- Packages on the banned list in `docs/01-stack-and-versions.md` section 3.6.

## Stop and ask the owner
Stop that line of work, send one short message, and continue with other work when you can:
- a human step is needed (the lists in `docs/14-ios-build-and-release.md` section 3.11);
- a gate, golden, baseline or fixture would change without an agreed reason;
- the spec is contradicted, ambiguous, or silent about something a player would see;
- an action is irreversible or leaves this Mac: an upload, submitting for review, App Store
  Connect changes, pushing, deleting what you did not create;
- a release step stops with a signing, agreement, 401/403 or INVALID error (never retry in a loop);
- anything would read, print or move the App Store Connect `.p8` key or a token.
Details and the full table: `docs/17-claude-code-playbook.md` section 5.

## Safety of the Mac and the accounts
- Never open, print, copy or commit `~/.appstoreconnect/private_keys/*.p8`; tools get only
  `ASC_KEY_ID`, `ASC_ISSUER_ID` and `APPLE_TEAM_ID`.
- Select Xcode through `DEVELOPER_DIR` (Xcode 26.6); never run `xcode-select`.
- Create simulators by name (`e07-<purpose>`) and touch only the ones you created.

## Commits
- Conventional Commits, `<type>(<scope>): <subject>`, at most 72 characters (`docs/03-naming.md` section 13).
- One behaviour per commit, tests and code together.
- `Gate-Change: <reason>` when a gated path changes; `Spec-Change: <section>` when a test
  expectation changes because the spec changed.
- Release commits and tags come only from `npm run release:ios`.

## Reporting
- Write for the owner in plain English: the outcome first, in players' words, then at most one
  request with its default, then what to look at, then what could not be verified.
- Use the evidence template in `docs/07-testing-and-tdd.md` section 3.17, with numbers from `reports/`.
````

The template is 89 lines.

---

## 9. The `CLAUDE.md`

Claude Code reads `CLAUDE.md` at startup and follows `@path` imports in it, so the repo root holds a one-line `CLAUDE.md` that imports `AGENTS.md`. Other agents read `AGENTS.md` directly, and nothing is written twice.

```text
@AGENTS.md
```

**Source:** [Claude Code memory: CLAUDE.md imports](https://code.claude.com/docs/en/memory).

---

## Checklist

- [ ] The session-start ritual (section 1) was run, and the tree was green before the first change.
- [ ] Every item of the definition of done (section 2) that applies has its evidence in the report.
- [ ] Every stop-and-ask case (section 5) that came up was asked, not worked around.
- [ ] Commits follow section 6; the report follows section 7.
- [ ] `AGENTS.md` and `CLAUDE.md` at the repo root match sections 8 and 9.

## Sources

- FINAL-DECISIONS D.41, D.42, E and F (binding).
- Claude Code memory and `CLAUDE.md` imports: https://code.claude.com/docs/en/memory
- Claude Code best practices (verification, hooks as gates): https://code.claude.com/docs/en/best-practices
- Claude Code hooks and permissions: https://code.claude.com/docs/en/hooks, https://code.claude.com/docs/en/permissions
- Conventional Commits 1.0.0: https://www.conventionalcommits.org/en/v1.0.0/

## Verified

Written on 2026-09-26 by the integration pass from the topic docs; every rule here points to the doc that owns and verified it. The `AGENTS.md` template was counted at 88 lines. On 2026-09-26 (final fixes) it gained a `docs/99-final-decisions.md` source-of-truth line (89 lines, counted with a script); every path in it is repo-relative (`spec.txt`, `docs/…`), and the bootstrap checklist's `eslint.config.mjs` entry now needs only docs/04 section 3, whose listing was linted and printed back byte-identical. Not verified in a live session: the `@AGENTS.md` import (from the current Claude Code memory documentation) and the bootstrap checklist end to end, because no repo exists yet.

## Open issues

1. **The bootstrap from the Expo template is not scripted.** No doc fixes the exact `create-expo-app` command and template for SDK 57, or the list of template files to delete. The first Shell session should record the commands it used in section 4.1 and in docs/02.
2. **Pushing and remotes.** The spec does not say whether the owner uses a remote repository or pull requests. Until the owner says so, pushing is treated as outward-facing (section 5), and `verify` runs through the pre-push hook when it happens.
3. **The new-game scaffold does not exist yet.** `npm run new-game` has a fixed path (docs/16) and a file list (docs/02 section 11.3), but the script is written at the end of the pilot (section 3.1 step 11).
