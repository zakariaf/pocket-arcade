# Pocket Arcade skills — catalogue (build plan)

45 skills. "Sources" says where each builder copies knowledge FROM (project files, read at build time only). The finished skill must never point back at them. Paths are relative to the repo root `E07/`.

| # | Skill | Job | Sources to copy from | Group |
|---|---|---|---|---|
| 0 | `pocket-arcade-index` | Router: every skill, when to load it, task→skills matrix, build orders for the Shell and for each game, how to report | all skills' frontmatter; docs/17, docs/00 | integrator |
| 1 | `pocket-arcade-product-spec` | The product: what the Shell and games are, S1–S15, N1–N12, features 8.x, the game contract, the catalogue of 26 games, open owner decisions | spec.txt; docs/00 §6; idea-hunt/shortlist.md, research-notes.md | G1 |
| 2 | `tdd-workflow` | Red-green-refactor loop, test naming, order of work per layer, evidence, never edit a test to pass | docs/07 §2–3.1, docs/17 §2–3, docs/99 D.41 | G1 |
| 3 | `quality-gates` | npm scripts, check:fast / verify, what each gate checks, fixing failures, Gate-Change trailer, lefthook + Claude Code hooks, guardrail | docs/16, docs/04 §limits, docs/99 D | G1 |
| 4 | `git-commits-and-reporting` | Conventional Commits, trailers, per-app tags, plain-language owner reports with evidence, stop-and-ask rules | docs/03 git, docs/17 §5–7, docs/07 evidence report | G1 |
| 5 | `monorepo-bootstrap` | Create the monorepo from empty: workspaces, Expo SDK 57 apps, packages, every config file, .npmrc, .gitignore, settings | docs/01, docs/02 manifests, docs/04 configs, docs/14 §3.1–3.3, docs/16, docs/17 §4.1 | G2 |
| 6 | `dependency-management` | Add/upgrade/remove packages: expo install, exact pins, min-release-age, allowScripts, banned list, licence audit, expo-doctor | docs/01, docs/13 supply chain, docs/16 | G2 |
| 7 | `expo-sdk-upgrade` | Runbook to move Expo SDKs (57→58): trigger, Xcode, enableSceneSupport, RNGH v3, Skia/Reanimated churn, re-verify | docs/01 upgrade policy, docs/08 pitfalls, docs/99 | G2 |
| 8 | `typescript-and-lint-rules` | tsconfig set, full ESLint flat config, size/complexity limits, forbidden patterns, how to split code | docs/04, docs/99 D.34–35 | G3 |
| 9 | `naming-conventions` | Files, identifiers, types, hooks, handlers, testIDs, i18n keys, events, scripts, env vars | docs/03 | G3 |
| 10 | `architecture-and-boundaries` | Monorepo layout, package responsibilities, dependency zones, the 9 ports and adapters, file placement, withShell, build variants | docs/02, docs/14 variants | G3 |
| 11 | `toybox-design-system` | Toybox tokens (colours per theme/game, type, spacing, radii, shadows, motion), the RN theme module, makeStyles, AppText, press squash, hard shadows | docs/18, design/toybox/tokens.json, docs/05 theme | G4 |
| 12 | `toybox-components` | All 53 components: anatomy, measurements, states, a11y, testIDs, RN templates + tests | docs/18 components, design/toybox.html, docs/05 | G4 |
| 13 | `code-drawn-art-and-icons` | The 41 icons as Skia paths, app icon / splash / store art with headless Skia, sprite pre-render | docs/18 icons, docs/09 art, docs/05 icons | G4 |
| 14 | `toybox-screens` | Per-screen build specs S1–S15: structure, components, spacing, copy keys, testIDs, ad slots, states | docs/18 screens, spec.txt S1–S15, design/toybox.html, design/shared/copy-deck.json | G5 |
| 15 | `navigation-and-routing` | React Navigation 7 static stack for S1–S15, typed params, groups, Back→Pause, direction | docs/06 §3 | G5 |
| 16 | `react-components-and-hooks` | Component/hook rules, React Compiler, effects discipline, store reads, lists, safe areas, any-size layout, error boundaries | docs/05 | G5 |
| 17 | `toybox-visual-parity` | Design screenshots for every screen + the compare loop that makes each built screen match them | design/toybox.html, docs/18, scratchpad research visual-parity-tooling.md and vp/ prototypes | G6 |
| 18 | `state-stores` | Zustand stores (settings, progress, stats, premium), pure reducers, selectors + useShallow, GameSession reducer | docs/06 §4–5 | G7 |
| 19 | `save-persistence-and-migrations` | Save document schema (valibot), SQLite sync API, WAL, current/backup, migrations + fixtures, node:sqlite tests, kill test, hydration | docs/06 §6–8 | G7 |
| 20 | `i18n-strings-and-catalogs` | react-intl, catalogs, semantic keys, ICU plurals, t()/<T>, polyfills, formatjs verify, catalog linter, translation workflow, the copy deck | docs/10, design/shared/copy-deck.json + .md | G8 |
| 21 | `rtl-and-direction` | RTL rules, direction switch + reload, mirroring, digits, bidi isolation, un-mirrored boards, testing RTL | docs/10, docs/05 RTL, docs/18 RTL | G8 |
| 22 | `accessibility` | Roles/labels/hints via i18n, 44pt, text scaling 200%, Toybox contrast table, reduce motion, VoiceOver board summary, tests | docs/15 a11y, docs/18 a11y | G8 |
| 23 | `performance-budgets` | Budgets, frame-time recorder, cold start, save-write perf, draw-call budget, rules | docs/15 perf | G8 |
| 24 | `new-game-scaffold` | Create apps/<game> end to end: config, palette, IDs, folders, catalogs, tests; the new-game checklist; scaffold script | docs/02 §7–8, §11.3, docs/17 §4.2, docs/14 per-game, spec 11–13 | G9 |
| 25 | `game-rules-engine` | GameModule contract (full types), pure engine, events, determinism policy, sfc32 PRNG (with golden values), property tests, save points | docs/08 §2–3, docs/02 §7, docs/07 §3.8.1 | G9 |
| 26 | `level-generation-and-solvers` | Generators, solvers (BFS/IDA*), par, stars, packs, daily seed contract + goldens, level quality metrics | docs/08, docs/06 daily, docs/07 goldens | G9 |
| 27 | `board-rendering-skia` | Picture renderer, timeline, frame clock (startAt fix), scene shared value, Atlas, board text/RTL, BoardLayout, particles, 120 Hz, lifecycle, pixel goldens | docs/08, docs/07 pixel goldens, docs/15 | G10 |
| 28 | `board-gestures-and-input` | useBoardGestures, hitTest, classifySwipe, intents → moves, RNGH 2 now / 3 later | docs/08 gestures | G10 |
| 29 | `realtime-game-loop` | Fixed-step UI-thread loop, simulate-then-replay, geom kit, recorded inputs | docs/08 real-time | G10 |
| 30 | `game-audio-and-haptics` | react-native-audio-api synth recipes, AudioContext lifecycle, categories, haptics mapping + throttle, WAV preview | docs/09 | G11 |
| 31 | `game-balance-and-bots` | Bots (random/greedy/lookahead), *.sim.test.ts, difficulty curves, tuning constants, the "fun within seconds" kill test | docs/08 bots, docs/07 sims, idea-hunt toy evidence | G11 |
| 32 | `admob-ads` | Setup, AdsPort + adapter, UMP consent, adPolicy (spec 8.8), banner/interstitial/rewarded, ADS_MODE, test IDs, SKAdNetwork, console steps | docs/11 | G12 |
| 33 | `premium-purchase` | expo-iap, PurchasePort, reducer for every S12 state, revocation, restore, pending, StoreKit test harness, ASC product creation | docs/12 | G12 |
| 34 | `privacy-and-network-audit` | The six N3 layers, banned SDKs, runtime guard, privacy manifest, App Privacy answers, secrets, release audit | docs/13 | G12 |
| 35 | `unit-and-component-tests` | Jest projects config, RNTL 14 async, renderWithShell, root mocks, fast-check, coverage, Stryker | docs/07 | G13 |
| 36 | `golden-tests` | Data goldens and board pixel goldens, jest -u policy, Gate-Change trailer, daily-challenge contract | docs/07 goldens, docs/16 gated paths | G13 |
| 37 | `e2e-maestro` | Install Maestro (checksum), flows, testIDs, launch-arg state setup, simulate offline, screenshot matrix, socket sampling | docs/07 Maestro, docs/13 layer F | G13 |
| 38 | `ios-simulator-build` | Prebuild, Release simulator build, install/launch/screenshot, variants, metro cacheVersion, Xcode 26.6 selection | docs/14 §3.1–3.5 | G14 |
| 39 | `ios-release-testflight` | Signing with the API key, archive/export/validate/upload, build numbers, tags, store-artifact gate, human steps, failure playbook | docs/14, docs/13 secrets | G14 |
| 40 | `troubleshooting-playbook` | Known failures and their fixes, gathered from all research and verification | every doc's open issues + Verified notes, scratchpad research | G14 |
| 41 | `skill-maintenance` | How to add/update skills: this standard, validator, self-tests, sync-shared, staleness check, routing evals | skills/_library/* | G14 |
| 42 | `settings-and-preferences` | The S11 settings model and rows end to end: store fields, rows, persistence, effects of each setting | docs/06 settings store, spec S11, docs/18 S11 | G5 |
| 43 | `daily-and-statistics` | Daily challenge (date→seed, streak rules, 7-day strip) and statistics model/cards, end to end | docs/06 §8, spec S9–S10, docs/18 | G7 |
| 44 | `game-host-integration` | Wiring a GameModule into the Shell: game screen host, HUD, pause/result flow, undo/hint/continue, save points, stars → progress | docs/06 §5, docs/08 §2, docs/02 §7 | G9 |

Shared canonical files in `_library/shared/` (synced into the skills that declare them):
- `toybox-tokens.json` (from design/toybox/tokens.json) → 11, 12, 13, 14, 17, 22
- `copy-deck.json` (from design/shared/copy-deck.json) → 14, 17, 20
- `fonts/` LilitaOne.ttf, Rubik (static 400/500/700), Vazirmatn-Regular/Bold.ttf + OFL texts → 11, 13, 17
- `check-lib.mjs` (walk files, report problems, exit codes, RESULT line) → every skill with scripts
