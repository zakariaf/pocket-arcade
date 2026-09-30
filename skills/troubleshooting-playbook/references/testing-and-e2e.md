# Jest, RNTL, Maestro and Stryker

Failures of unit, component, golden, mutation and end-to-end tests. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Jest setup
- Mocks
- Goldens
- Coverage
- RNTL
- Mutation
- Layout
- Maestro
- Purchases
- Balance
- E2E flows
- Sims

## Jest setup

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-babel-config-missing` | Every Jest suite fails with a Flow syntax error in @react-native/jest-preset/jest/setup.js | babel.config.js is missing, so jest-expo cannot transform React Native | Create babel.config.js (npx expo customize babel.config.js; presets: babel-preset-expo) | verified | `unit-and-component-tests` |
| `testing-esm-transform` | SyntaxError: Cannot use import statement outside a module in react-intl / @formatjs / intl-messageformat | All FormatJS packages are ESM-only | Allowlist them in transformIgnorePatterns | verified | `unit-and-component-tests` |
| `testing-skia-global-env` | After setting Skia's jestEnv globally, React Native tests misbehave and every file loads CanvasKit | Skia's jestEnv extends plain jest-environment-node and replaces RN's environment for every test | Jest projects: unit (jest-expo) and golden (*.golden.test.ts with the Skia env) | verified | `golden-tests` |
| `testing-jest-logic-project-speed` | Pure-logic tests take 6-7 s cold per file | The jest-expo environment is loaded even for pure rules | Kept as decided (one unit project); revisit with a Node-environment logic project if npm test passes about 60 s | open | `unit-and-component-tests` |
| `testing-selectprojects-path-order` | jest --selectProjects unit <file> runs the whole suite instead of the file | Jest reads every word after --selectProjects as another project name | Put the paths first: npx jest <file> --selectProjects unit | verified | `unit-and-component-tests` |
| `testing-duplicate-manual-mock` | jest-haste-map: duplicate manual mock found: expo-iap | Jest indexed skills/, whose fixtures ship __mocks__ with the app's names, and may apply a fixture's mock | Ignore skills, .claude and .stryker-tmp in modulePathIgnorePatterns and testPathIgnorePatterns (the current jest.config.js; check-test-setup jest-ignored-paths) | verified | `unit-and-component-tests` |
| `testing-mock-calls-accumulate` | A mock expected once is called 2 or 4 times (calls from earlier tests in the file) | The Jest config lacks clearMocks and restoreMocks, so mock calls pile up across tests | Use the canonical jest.config.js (clearMocks: true, restoreMocks: true); never reset by hand in each test | verified | `unit-and-component-tests` |
| `testing-render-with-shell-no-shell-context` | check-test-setup fails render-with-shell-missing although the only component test says // no-shell-context: in its header | An older check-test-setup counted tests that need no Shell providers | Use the current unit-and-component-tests: tests marked // no-shell-context: <why> are not counted; the helper is required once a component test needs the Shell | verified | `unit-and-component-tests` |

## Mocks

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-gma-turbomodule` | TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could not be found | A test imported the real AdMob library | Root manual mock __mocks__/react-native-google-mobile-ads.ts (applied without jest.mock); Shell tests use fake ports | verified | `unit-and-component-tests` |
| `testing-skia-jsi-unit` | Native Skia Module failed to correctly install JSI Bindings! | Skia was imported in the unit project (jest-expo environment) | Test board geometry as pure functions; pixel tests go in the golden project (testEnvironment @shopify/react-native-skia/jestEnv.js) | verified | `unit-and-component-tests` |
| `testing-reanimated-resolver` | Cannot find module react-native-reanimated/jest/resolver | That path exists only in newer Reanimated docs, not in 4.5.1 | jest.setup: RNGH jestSetup, jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock')), require('react-native-reanimated').setUpTests() | verified | `unit-and-component-tests` |
| `testing-audio-mock-incomplete` | AudioManager.setAudioSessionOptions is not a function in tests | react-native-audio-api 0.13.6's own mock lacks setAudioSessionOptions and observeAudioInterruptions | Extend it in the root mock; re-check on every bump | verified | `game-audio-and-haptics` |
| `testing-perf-now-mock` | performance.now() timings in Jest are coarse | The jest preset's performance.now mock has 1 ms resolution | Measure fast code over many iterations; real timings come from device runs | verified | `performance-budgets` |
| `testing-isrtl-mock` | I18nManager.isRTL is false in every Jest test | @react-native/jest-preset mocks it | Test RTL through an explicit DirectionProvider direction="rtl"; layout itself is checked on the simulator | verified | `rtl-and-direction` |
| `testing-admob-mock-outdated` | TypeError: AdsConsent.getUserChoices is not a function in a test | An older copy of the AdMob root mock lacks getUserChoices (the consent debug adapter calls it) | Keep one mock: admob-ads' __mocks__/react-native-google-mobile-ads.ts | verified | `unit-and-component-tests` |

## Goldens

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-ci-snapshot` | New snapshot was not written. The update flag must be explicitly passed | jest --ci (default when CI=1) never writes snapshots | Create or update goldens deliberately with jest -u and a Gate-Change trailer | verified | `golden-tests` |
| `testing-golden-text-tolerance` | A pixel golden passes although a two-digit label is missing | 0.1% tolerance: 77 of 218,400 pixels (0.035%) on a 390x560 board | Add recording-canvas assertions for every label, or a pixel-count threshold for text goldens | verified | `golden-tests` |
| `testing-snap-ios-path` | jest -u writes golden snapshots to *.snap.ios files that the gate does not know | The jest-expo/ios preset adds the platform suffix next to the test | Keep **/*.golden.test.ts.snap.ios in gatedPaths (add *.snap.android when Android starts); commit with a Gate-Change trailer | verified | `golden-tests` |
| `testing-sim-baselines-runtime` | Simulator screenshot baselines differ after an Xcode or iOS runtime change | Rendering differs across iOS runtime versions | Tie baselines to one device model and runtime (iPhone 17 Pro Max and iPad Pro 13-inch (M5), iOS 26.5) and regenerate them deliberately with a Gate-Change trailer | documented | `e2e-maestro` |
| `testing-golden-update-all` | npx jest --selectProjects golden <file> -u rewrote every golden in the project | The path after --selectProjects is read as a project name, so -u applies to all golden tests | Always npx jest <file> --selectProjects golden -u; restore the other goldens from git | verified | `golden-tests` |
| `testing-obsolete-snapshot` | Jest exits 1 with "1 snapshot obsolete" although every test passed | Jest 29.7 fails the run on obsolete snapshot entries, with or without --ci | Remove the obsolete entry with the path-first -u command for that one file, or restore the test that owned it | verified | `golden-tests` |

## Coverage

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-coverage-missing-dir` | Jest: Coverage data for ./packages/... was not found (exit 1) | A coverageThreshold key names a folder with no files yet | Add threshold keys only when fs.globSync finds source files (jest.config.js does) | verified | `unit-and-component-tests` |
| `testing-untested-helper` | check-tests reports untested-module for a helper that is only tested through its caller (a selector, flip-cells.ts, session-controller.ts) | The rule is "every pure module has its own test"; a caller's test does not count | Write a small direct test next to the module (examples plus a property where it fits); a device-only marker is only for wrappers Jest cannot load | verified | `tdd-workflow` |
| `testing-coverage-untested-templates` | npm run test:coverage fails on a repo built from the templates: Jest: "global" coverage threshold for statements (90%) not met: 83.8% | Template files that ship neither a test nor the device-only marker count at 0% (native adapters, Skia and frame-callback modules, composition files, model hooks) | Give each file a test (fakes, pure helpers, model hooks through renderWithShell) or, for native, Skia, frame-callback and composition files only, the line "// device-only: covered by <e2e flow or simulator check>" in its first 6 lines; jest.config.js leaves exactly the marked files out through packages/tooling/src/quality/device-only.ts. Never lower a threshold or hand-write coveragePathIgnorePatterns | verified | `unit-and-component-tests` |
| `testing-subset-coverage-threshold` | A subset run such as npx jest apps/<id>/src/rules --ci --coverage --selectProjects unit exits 1: Jest: "global" coverage threshold for statements (90%) not met: 0% (or 6.18%), although every test passed | The root config's thresholds count every file collectCoverageFrom names, and the subset ran only a few of them | Only npm run test:coverage judges the thresholds. For a subset: npx jest <paths> --ci --selectProjects unit --coverage --collectCoverageFrom='<path>/**/*.ts' --coverageThreshold='{}' (paths first) | verified | `unit-and-component-tests` |

## RNTL

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-rntl-async` | act() warnings or empty screens in RNTL 14 tests | RNTL 14 render, fireEvent and user events are async | await render(), await user.press(), await fireEvent.press() | verified | `unit-and-component-tests` |
| `testing-router-pathname` | expect(screen).toHavePathname throws 'screen.getPathname is not a function' | expo-router testing-library was written for RNTL 13 | Not used here (React Navigation); if ever needed, use the view returned by renderRouter | documented | `unit-and-component-tests` |
| `testing-getbyrole-view` | getByRole cannot find a View with a role | A plain View is found by role only when accessible | Set accessible on the View (Pressable is accessible by default) | verified | `unit-and-component-tests` |
| `testing-hidden-decorative-parts` | A component test cannot find the testID of a decorative part (logo art, stars, icon tile) | Toybox components hide decorative parts from VoiceOver, and RNTL skips hidden elements by default | Query decorative parts with { includeHiddenElements: true }; interactive elements stay visible to VoiceOver | verified | `unit-and-component-tests` |
| `testing-render-with-shell-stores` | renderWithShell fails tsc: type '{ settings; premium }' is missing the following properties from type 'ShellStores': progress, stats | An older render-with-shell.tsx predates the four-store setup | Use unit-and-component-tests' current render-with-shell.tsx | verified | `unit-and-component-tests` |
| `testing-catalog-en-dash` | A screen test expects "Premium - active" but renders "Premium – active" | The copy deck uses an en dash; the test typed a hyphen | Assert the catalog text exactly; check-catalogs names the first differing code point | verified | `unit-and-component-tests` |

## Mutation

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-stryker-worklet` | Stryker's initial run fails on a file-level 'worklet' module | Stryker injects helper functions that the Worklets plugin then workletizes | Compile Stryker workers without the Worklets/Reanimated plugins (babel.config.js branch); worklet-transform.test.ts covers the transform | verified | `unit-and-component-tests` |
| `testing-stryker-nocoverage` | Stryker reports NoCoverage or false survivors for workspace modules | Its sandbox imported the original files through node_modules symlinks | Map @e07/* to <rootDir> paths with moduleNameMapper | verified | `unit-and-component-tests` |
| `testing-weak-properties` | Mutants survive in an RNG covered only by properties | Determinism and range properties do not pin exact outputs | Add golden example values next to every property test | verified | `game-rules-engine` |
| `testing-premium-reducer-mutants` | Stryker leaves NoCoverage at premium-reducer.ts:22 and a survivor at line 27 | No example dispatches connect-started, and replacing state.flow.kind === 'loading' with true survives | Add one example for each when the reducer is implemented | open | `premium-purchase` |
| `testing-stryker-sandbox-skills` | Stryker copies about 16,000 files into its sandbox and every mutant run is slow | The sandbox included skills/ and .claude/ | Add "skills" and ".claude" to ignorePatterns in stryker.config.json (338 files instead of 16,152) | verified | `unit-and-component-tests` |

## Layout

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-node-api-tests` | A test using node:sqlite, Buffer or node:fs fails tsc inside packages/shell | Package programs carry only jest types | Put Node-API tests and drivers under the root test/integration/<area>/ | verified | `unit-and-component-tests` |
| `testing-perf-test-clock` | check-tests reports nondeterminism for performance.now() in a save-write speed test | Only test/**/*.perf.test.ts files may time real work, with performance imported from node:perf_hooks | Move the timing test to test/<area>/<name>.perf.test.ts and import { performance } from 'node:perf_hooks' | verified | `tdd-workflow` |

## Maestro

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-maestro-airplane` | setAirplaneMode does nothing on the iOS simulator | iOS simulators have no airplane mode (Android-only command) | Use the test build's Simulate offline debug switch | verified | `e2e-maestro` |
| `testing-maestro-hierarchy-limits` | maestro hierarchy misses testIDs | It lists only on-screen elements, hides children of accessible elements, and rounds bounds to whole points (about 11-19 s per call) | Put testIDs on the accessible element (the Pressable), scroll to the element first, allow ±1 pt | verified | `e2e-maestro` |
| `testing-maestro-ai-commands` | A flow uses assertWithAI, assertNoDefectsWithAI or extractTextWithAI | They upload screenshots to an LLM service | Ban them in e2e/** (guardrail grep) | verified | `e2e-maestro` |
| `testing-maestro-tags-flag` | maestro test --tags is rejected | Maestro 2.10 has --include-tags and --exclude-tags, no --tags | Use --include-tags / --exclude-tags | verified | `e2e-maestro` |
| `testing-maestro-subfolders` | Flows in sub-folders do not run | Maestro does not recurse into sub-folders | List the <area>/<nn>-<name>.yaml files explicitly (run-e2e-ios.ts does) | verified | `e2e-maestro` |
| `testing-maestro-java` | maestro fails to start: no Java 17 | Maestro needs Java 17; this Mac has it only as Android Studio's JBR | JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home (or /usr/libexec/java_home -v 17) | verified | `e2e-maestro` |
| `testing-board-layout-missing` | An E2E flow cannot find game.board-layout, so board taps have no coordinates | The board host does not render the test-build board-layout element yet | game-board-host.tsx renders game.board-layout in test builds when launched with boardLayout=1 | open | `e2e-maestro` |
| `testing-e2e-no-cold-start` | npm run e2e:ios reports no cold-start or memory numbers and always uses the large text size | run-e2e-ios.ts has no cold-start/footprint step and no --text-size option yet | Add both to run-e2e-ios.ts so the a11y pass needs no hand-run commands (screenshots:ios already has --text-size) | open | `performance-budgets` |
| `testing-maestro-screen-root` | The screenshot matrix waits 15 s and fails on game-start, result-win and similar screens | shoot-screen.yaml waited for ${SCREEN}.screen, but those screens render game.screen and result.screen | Pass the screen's root testID as ROOT to shoot-screen.yaml (current e2e-maestro matrix) | documented | `e2e-maestro` |
| `testing-maestro-upload` | A Maestro command sent the run off the Mac (test --analyze, cloud, login, record without --local) | Those commands upload screens or results to Maestro's cloud, which the offline policy forbids | Never use them; check-e2e-setup reports them as maestro-upload | documented | `e2e-maestro` |
| `testing-debug-link-before-ready` | A debug link is ignored after launchApp clearState: the flow's first openLink (debug-setup) applies no language, save or screen and the error log stays empty, while the same link a few seconds later works; or firstRun=0&screen=game in one link lands on Home instead of Game | The app was launched without the URL and its JS had not started the link handler yet, so neither getInitialURL nor the url event delivered the link; a screen= opened before the Main group mounted is lost as well | Use e2e-maestro's link timing: the debug link handler starts listening when createDebugParts runs and queues links until the navigator is ready, applies the save changes first and opens screen= on the next navigation state; debug-setup.yaml waits for the app's first screen root (language-choice.screen, tutorial.screen, home.screen or not-built.screen) before openLink. Never add a fixed sleep | verified | `e2e-maestro` |
| `testing-memory-app-not-running` | npm run e2e:ios fails the memory step: "memory: the app is not running after the smoke flow", so check-e2e-report fails memory | Maestro 2.10 stops the app when a test ends, so no app process is left for footprint to measure | Use e2e-maestro's sim-perf-steps template: after the smoke flows it relaunches the app with xcrun simctl launch (the app resumes its saved state), waits for its pid and 10 s more, then runs footprint; its test covers the relaunch | documented | `e2e-maestro` |
| `testing-maestro-evalscript-colon` | maestro check-syntax (check-flows --syntax) prints "Parsing Failed at <line>:<col>" on an evalScript line that holds a ternary (cond ? a : b) | A ": " inside a plain YAML scalar starts a mapping, so the flow file is not valid YAML | Write the choice as arithmetic (Number(cond)) or quote the whole scalar; never put ": " in an unquoted evalScript | verified | `e2e-maestro` |

## Purchases

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-storekit-runner-unrun` | The first storekit-harness.ts run on the pilot app fails at Metro readiness or flow order | The Tier-2 runner and its seven flows were verified step by step, never as a whole | Run it once on the pilot, fix the order or wait, and record the result | open | `premium-purchase` |

## Balance

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-balance-fingerprint-stale` | A game balance report stays fresh after game-kit geom/ or timeline code changed | The report fingerprint covered only part of packages/game-kit/src | Use the current game-balance-and-bots writer (the fingerprint covers all of game-kit) and rerun the sim | verified | `game-balance-and-bots` |
| `testing-sim-no-tests-found` | npm run verify stops at test:sim: "No tests found, exiting with code 1" | No game has a *.sim.test.ts yet: before the pilot's sims (Shell build step 3) test:sim has nothing to run | Expected before that step (quality-gates, "When verify is green"). While shell-slice.json exists, verify skips the step with SKIP jest.sim.config.js [test-sim]; otherwise build the pilot's sims. Never add --passWithNoTests | verified | `quality-gates` |

## E2E flows

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-flows-missing` | check-flows fails [flows-missing]: the repo has no Maestro flows | A full Shell (no shell-slice.json) must have its E2E flows; only a declared partial Shell skips the rule | Write the flows with e2e-maestro (numbered flows under packages/shell/e2e/flows/ and each game's own), or declare the partial Shell in shell-slice.json while it is one | verified | `e2e-maestro` |

## Sims

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `testing-balance-report-stale` | check-balance fails [report-stale] although the rules and tuning did not change | The balance report's fingerprint covers the game's logic folders, the sim file and the game-kit files those import (followed through game-kit's own imports); one of them changed, or reports/ is gitignored and the local report was made before the change | Rerun npm run test:sim, then check-balance.mjs . --game <id>; never edit the report by hand. New game-kit files the sims do not import (timeline, particles, geometry) leave the report fresh | verified | `game-balance-and-bots` |
| `testing-balance-harness-outdated` | check-balance fails [harness-outdated] (or [report-stale] right after upgrading the skills) | packages/tooling/src/sims/write-sim-report.ts is an older copy that hashes all of packages/game-kit/src, not only the game-kit files the sims import | Copy game-balance-and-bots' packages/tooling/src/sims/write-sim-report.ts and its test write-sim-report.test.ts again, then rerun npm run test:sim and check-balance.mjs . --game <id> | verified | `game-balance-and-bots` |
