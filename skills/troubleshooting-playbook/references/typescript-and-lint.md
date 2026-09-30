# TypeScript and ESLint

Compiler and lint errors seen with the strict TypeScript 6 setup and the one ESLint 9 flat config, and the config bugs found while verifying them. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- TypeScript
- ESLint config
- Naming
- Components
- Imports
- Tests

## TypeScript

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `lint-ts2593-jest-types` | TS2593: Cannot find name 'describe' | TypeScript 6 defaults types to [], so Jest globals are unknown | Give test programs types: ["jest"] (tooling: ["node", "jest"]) | verified | `typescript-and-lint-rules` |
| `lint-ts2591-process` | TS2591: Cannot find name 'process' (or 'node:fs') in the Shell or in scripts | The program has no Node types | Shell: declare const process in app-env.d.ts; Node scripts: a tsconfig with types node (never add Node types to app code) | verified | `typescript-and-lint-rules` |
| `lint-ts4111-env` | TS4111 on process.env.EXPO_PUBLIC_APP_VARIANT or process.argv | noPropertyAccessFromIndexSignature requires bracket access unless the property is declared | Declare EXPO_PUBLIC_* in NodeJS.ProcessEnv (Expo inlines only dot access); bracket access in Node code | verified | `typescript-and-lint-rules` |
| `lint-ts1294-erasable` | TS1294: enum or constructor parameter property rejected | erasableSyntaxOnly (needed for Node type stripping) forbids non-erasable syntax | Use string-literal unions and 'as const' objects; plain constructor fields | verified | `typescript-and-lint-rules` |
| `lint-exact-optional` | exactOptionalPropertyTypes rejects an explicit undefined prop (for example asChild) | Some third-party prop types do not include undefined | Conditional spread {...(x ? { asChild: true } : {})}; relax the flag only in the app workspace if unavoidable | verified | `typescript-and-lint-rules` |
| `lint-expo-env-textstyle` | TS2559 on TextStyle after adding expo-env.d.ts to an app program | expo-env.d.ts pulls types that clash with the strict setup | Do not include expo-env.d.ts; app-env.d.ts declares what is needed | verified | `typescript-and-lint-rules` |
| `lint-config-type-import` | A type-only import from an app file into with-shell.ts breaks tsc (process, node:fs unknown) | with-shell.ts is Node-world code; importing an app file drags the app program in | Keep GameConfig in the neutral @e07/shell/config/game-config.ts | verified | `architecture-and-boundaries` |
| `lint-scripts-typecheck` | Node scripts fail tsc with TS2591 (node:fs) and TS4111 (process.argv) | types: ['jest'] leaves out Node types for scripts inside the app program | Keep Node scripts in packages/tooling with types ["node", "jest"]; never inside an app program | verified | `typescript-and-lint-rules` |
| `lint-tsconfig-baseurl` | A tsconfig copied from the Expo TypeScript guide sets baseUrl and paths | The guide's example lags the template | Copy the template form (extends expo/tsconfig.base, no baseUrl); cross-package imports use @e07/<package>/<path>.ts | documented | `typescript-and-lint-rules` |
| `lint-prettier-filled-template` | prettier --check fails on a template right after its __PLACEHOLDERS__ were filled | Filled values change line lengths, so the wrapping no longer matches Prettier | Run npx prettier --write on the filled files before lint and commit | verified | `typescript-and-lint-rules` |
| `lint-vendor-adapter-async` | The vendor-port-adapter template fails tsc when the vendor call is async | The result type was ReturnType<…>, which is a Promise for an async call | Use Awaited<ReturnType<…>> (the current template) | verified | `architecture-and-boundaries` |
| `lint-clockport-missing-member` | TS2741: Property 'msUntilNextLocalDay' is missing in type '{ nowMs: …; today: … }' but required in type 'ClockPort' | A hand-written clock object from before ClockPort gained msUntilNextLocalDay (S9 countdown) | In tests use createFakeClock from services/clock/fake-clock.ts (or add msUntilNextLocalDay); code that only reads the time takes Pick<ClockPort, 'nowMs'> | verified | `daily-and-statistics` |
| `lint-ts2769-navigate-never` | tsc -p apps/<id> fails with TS2769 "No overload matches this call": Argument of type '"Settings"' is not assignable to parameter of type 'never' at every navigation.navigate(...) in Shell hooks, while tsc -p packages/shell passes | The app program type-checks the Shell files it imports but never sees packages/shell/src/navigation/react-navigation.d.ts: nothing imports a global augmentation, so RootParamList is empty there | Add the Shell's packages/shell/src/navigation/react-navigation.d.ts to the include list of apps/<id>/tsconfig.json (as a path relative to the app folder, next to the app-env.d.ts entry); typescript-and-lint-rules' tsconfig.app.json has it and check-configs requires it | verified | `typescript-and-lint-rules` |

## ESLint config

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `lint-jest-rules-spread` | Assertion-free tests, duplicate titles and conditional expects pass lint | The test block spread flat/recommended and flat/style into one object; the second rules key replaced the first | Use extends: [jestPlugin.configs['flat/recommended'], jestPlugin.configs['flat/style']]; the guardrail asserts jest/expect-expect is active | verified | `typescript-and-lint-rules` |
| `lint-await-fireevent` | `fireEvent.press` is sync and does not need `await` | testing-library's no-await-sync-events contradicts RNTL 14, where fireEvent returns a Promise | Turn testing-library/no-await-sync-events off; keep await-async-events and no-floating-promises | verified | `typescript-and-lint-rules` |
| `lint-left-right-game-logic` | The physical-direction ban fires on { left, right } keys in pure game rules | The selector matched any object key, but boards and game data are exempt from RTL rules | Scope the selector to style contexts (StyleSheet.create, style props, *Style-typed variables) | verified | `typescript-and-lint-rules` |
| `lint-complexity-switch` | An exhaustive 11-case switch fails 'complexity of 12. Maximum allowed is 10' | ESLint 9 counts every case, ?., ??, default parameter and logical assignment | complexity: ['error', { max: 10, variant: 'modified' }] (a switch counts once); sonarjs cognitive complexity still bounds nesting | verified | `typescript-and-lint-rules` |
| `lint-determinism-leaks` | new Date() or performance.now() pass lint in game logic | Only Date.now and Math.random were banned | Add NewExpression[callee.name='Date'][arguments.length=0] and performance.now to the bans | verified | `typescript-and-lint-rules` |
| `lint-remote-url-literals` | <Image source={{ uri: "https://..." }} /> passes lint | Layer A banned fetch but not URL literals, yet a remote image makes a request | Ban Literal and TemplateElement values starting with http(s)://, ws(s)://, ftp://; allow only external-links.ts | verified | `privacy-and-network-audit` |
| `lint-warnings-pass` | exhaustive-deps, incompatible-library or unsupported-syntax only warn | eslint-plugin-react-hooks recommended marks them warn | Run eslint --max-warnings 0 and raise them to error | verified | `typescript-and-lint-rules` |
| `lint-inline-disable-inert` | An // eslint-disable comment has no effect and is reported | linterOptions.noInlineConfig and reportUnusedDisableDirectives | Fix the code, or add a named file-level exemption in eslint.config.mjs with the owner's agreement | verified | `quality-gates` |
| `lint-flat-config-replace` | A later config block silently drops restricted paths of an earlier block | In flat config a later block replaces (not merges) the options of the same rule | Repeat the shared paths (build blocks from shared constants such as RUNTIME_PATHS) | verified | `typescript-and-lint-rules` |
| `lint-import-order-type` | import/order wants a blank line between value and type imports of the same module | 'type' is its own group with newlines-between always | Put import type statements in a final group after a blank line | verified | `typescript-and-lint-rules` |
| `lint-unbound-method-tests` | @typescript-eslint/unbound-method flags expect(sdk.method) in tests; jest/unbound-method crashes under disableTypeChecked | Library-typed methods look unbound | Type the requireMock result locally or use jest/unbound-method; exclude **/*.test.ts from disableTypeChecked blocks | verified | `unit-and-component-tests` |
| `lint-mock-naming` | naming-convention errors in __mocks__/react-native-google-mobile-ads.ts | The mock mirrors the library's PascalCase exports (AdsConsent, TestIds) | Turn naming-convention off for __mocks__/** | verified | `unit-and-component-tests` |
| `lint-lint-scale` | npm run lint grows slow with many apps | Type-aware lint builds one program per workspace | Lint per workspace in parallel past about 2 minutes; never weaken rules | open | `typescript-and-lint-rules` |
| `lint-no-dynamic-env-var` | expo/no-dynamic-env-var inside packages/shell/src | process.env['X'] or a computed env name; Expo inlines only literal dot access | Pass process.env into withShell from app.config.ts and read the variable there; in app code use process.env.EXPO_PUBLIC_X literally | verified | `typescript-and-lint-rules` |
| `lint-test-only-require` | @typescript-eslint/no-require-imports in packages/shell/src/app/test-only.ts | The one file-level exemption is missing from eslint.config.mjs | The config exempts exactly packages/shell/src/app/test-only.ts; nothing else may require() | verified | `ios-simulator-build` |
| `lint-max-lines-data` | max-lines fails on a level pack, palette or catalog file | Large data tables were written as TypeScript | Move data to JSON (import ... with { type: 'json' }) or add a named exemption with the owner; split code by responsibility, not by line count | verified | `typescript-and-lint-rules` |
| `lint-compiler-rules-upgrade` | New react-hooks errors appear after a dependency bump | Compiler rules arrive with eslint-plugin-react-hooks minor versions | Run lint after every bump and fix the code; never turn the rule off | documented | `dependency-management` |
| `lint-exemption-file-renamed` | A clock adapter, direction module, AppText or external-links file suddenly fails lint | The ESLint exemptions name exact files; the file was renamed or moved | Keep the canonical file names; if a rename is right, change the exemption glob with the owner and a Gate-Change trailer | verified | `typescript-and-lint-rules` |
| `lint-haptics-catch` | Haptics calls end in .catch(() => undefined), which looks like a swallowed error | Expo documents haptics as a no-op in Low Power Mode and similar states | Kept as the one allowed fallback (a stack decision) inside the haptics adapter; everywhere else errors are recorded | open | `game-audio-and-haptics` |
| `lint-draw-five-params` | max-params fails on draw(canvas, view, fx, colors, layout) | The renderer contract has five inputs and the limit is three | Use draw(canvas, frame) with frame = { view, fx, colors, layout, kit } | verified | `board-rendering-skia` |
| `lint-prettier-pre-existing` | Prettier or ESLint fails on folders that were in the repo before the monorepo (the owner's handbook, design and research folders) | An older .prettierignore ignored only the docs folder and skills/, and PRE_EXISTING in eslint.config.mjs was left empty | Use the current .prettierignore (adds .claude/ and the __PRE_EXISTING__ list) and fill PRE_EXISTING in eslint.config.mjs; check-configs reports ignore-pre-existing | verified | `typescript-and-lint-rules` |

## Naming

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `lint-boolean-constant-naming` | IS_DEBUG_BUILD rejected: must have one of the following prefixes | The boolean prefix rule allowed only camelCase prefixes | Allow UPPER_CASE with IS_/HAS_/CAN_/SHOULD_/DID_/WILL_/WAS_ prefixes | verified | `naming-conventions` |
| `lint-destructured-boolean` | const { granted } = ... or ({ disabled }: Props) rejected by naming-convention | Destructured booleans need the is/has prefix too | Rename while destructuring: { granted: isGranted } | verified | `naming-conventions` |
| `lint-navigator-constant-name` | const RootStack = createNativeStackNavigator(...) rejected | A navigator object is a value, so camelCase | rootStack plus StaticParamList<typeof rootStack> and a ReactNavigation.RootParamList merge in a .d.ts | verified | `naming-conventions` |
| `lint-blocklist-invalid-pattern` | check-file/filename-blocklist crashes with "invalid pattern" | The suggestion was free text | Give the rule a glob suggestion such as '**/[a-z]*-[a-z]*.ts' | verified | `naming-conventions` |

## Components

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `lint-pressed-callback` | ({ pressed }) in a style callback fails naming; void promise.then(...) fails no-floating-promises | Boolean parameter naming and ignoreVoid: false | Rename ({ pressed: isPressed }); await or handle promises through the async-handler helper | verified | `react-components-and-hooks` |
| `lint-makestyles-unused` | no-unused-styles reports every key as unused ("undefined.base") | makeStyles returned StyleSheet.create(...) directly | Use the block body: const styles = StyleSheet.create(...); return styles; | verified | `toybox-design-system` |
| `lint-props-mutation` | props.items.push() is not flagged by the compiler rules | The React Compiler lint does not see array mutation through props | Type props readonly (readonly T[]) | verified | `react-components-and-hooks` |

## Imports

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `lint-metro-extensions` | Metro or tsc cannot resolve @e07/shell/<path> without an extension | Workspace packages are consumed as TypeScript source with explicit extensions | Import @e07/shell/ui/app-text.tsx and ./x.ts with extensions; packages/shell exports './*': './src/*' and './plugins/*' | verified | `architecture-and-boundaries` |
| `lint-rn-deep-imports` | react-native/Libraries/* imports become type errors on RN 0.87 / SDK 58 | RN 0.87 makes the Strict TypeScript API the default | Never deep-import; opt into customConditions ['react-native-strict-api', 'react-native'] now | verified | `typescript-and-lint-rules` |
| `lint-paths-in-node` | Node scripts cannot import '@/...' aliases | Node type stripping ignores tsconfig paths | Use package self-references @e07/<package>/<path>.ts (exports map) | verified | `architecture-and-boundaries` |
| `lint-game-art-missing` | Cannot find module '@e07/shell/art/game-art.ts' | shell-game-module.ts imports the GameArt types, which no skill shipped before | Copy game-host-integration templates/packages/shell/src/art/game-art.ts and credit-entry.ts (only when missing) | verified | `game-host-integration` |

## Tests

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `lint-test-title-verb` | it should match /^(can\|[a-z]+s)\b/u  jest/valid-title | Test titles start with a third-person verb or 'can' (the canonical ESLint config) | Write it('returns …'), it('swallows …') or it('can …'), not it('return …') or it('never throws') | verified | `unit-and-component-tests` |
| `lint-prefer-to-be-pinned` | Use toBe when expecting primitive literals (jest/prefer-to-be) in a filled logic.test.ts | The pinned example returns a number, string or boolean literal, and toStrictEqual is rejected for those | Fill the template's __EQUALITY_MATCHER__ with toBe for a primitive and toStrictEqual for an object or array | verified | `tdd-workflow` |
