# Forbidden patterns and what to write instead

Every pattern the canonical config rejects, why, which rule enforces it, and the replacement. Read this when a lint or `tsc` error needs a fix, or before writing code that touches time, randomness, network, text, styles or imports. The fix is always in the code; silencing a gate is itself forbidden.

## Contents

- Silencing gates
- TypeScript syntax
- Exports and imports
- Promises, handlers and errors
- Time, randomness and determinism
- Network and packages
- Text, direction and styles
- React and UI primitives
- Tests
- Comments

## Silencing gates

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| `// eslint-disable...`, `/* eslint ... */`, `/* global */` | the most likely failure of an unsupervised agent is silencing a check; inline config is switched off and reported | `noInlineConfig`, `reportUnusedDisableDirectives`, `check-source.mjs` `no-inline-config` | fix the code; a real exception is a files-scoped block in `eslint.config.mjs` with a `Gate-Change:` trailer |
| `// @ts-ignore`, `// @ts-nocheck` | hides type errors | `@typescript-eslint/ban-ts-comment`, `no-ts-ignore` | fix the type |
| `// @ts-expect-error` without a reason of 10+ characters | allowed only where a third-party type is wrong | `ban-ts-comment`, `ts-expect-error-reason` | `// @ts-expect-error: expo-iap types miss revocationDate` |
| `eslint --rule ...`, `--no-inline-config`, `--config` in scripts | CLI flags bypass the config | `check-configs.mjs` `lint-script` | run ESLint only through the npm scripts |
| a second ESLint or Prettier config | two sources of truth | `config-stray` | one `eslint.config.mjs`, one `.prettierrc.json` |

## TypeScript syntax

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| `enum`, `const enum` | not erasable (Node type stripping); unions work with exhaustive switches | `erasableSyntaxOnly`, `TSEnumDeclaration` selector, `no-enum` | `const GAME_MODES = ['levels', 'daily', 'endless'] as const; type GameMode = (typeof GAME_MODES)[number];` |
| `namespace X {}` (outside `*.d.ts`) | not erasable | `erasableSyntaxOnly`, `no-namespace` | plain modules; `declare namespace` only for merging in `*.d.ts` |
| constructor parameter properties (`constructor(private x: X)`) | not erasable | `erasableSyntaxOnly`, `no-parameter-property` | declare the field, assign it in the body (or use a factory function) |
| `interface` (outside `*.d.ts`) | one way to declare types | `consistent-type-definitions`, `no-interface` | `type X = { ... }`; `interface` only for declaration merging (`NodeJS.ProcessEnv`, `ReactNavigation.RootParamList`) |
| `any`, unsafe member access | type holes | typescript-eslint strict, `no-explicit-any` | `unknown` plus narrowing, or the real type |
| non-null `value!` in app code | hides `undefined` that `noUncheckedIndexedAccess` made visible | `no-non-null-assertion` (off in tests) | `if (x === undefined) return ...;` or `?? fallback` |
| truthiness on strings and numbers (`if (count)`) | `0` and `''` bugs | `strict-boolean-expressions` | `if (count > 0)`, `if (name !== '')` |
| non-exhaustive `switch` over a union | a new member is silently ignored | `switch-exhaustiveness-check` | a `case` per member; no `default` for unions |
| missing return type on an export | the contract is implicit | `explicit-module-boundary-types` | `export function f(x: X): Y` |
| `import { X }` for a type | Babel/Metro single-file transforms | `consistent-type-imports`, `verbatimModuleSyntax` | `import type { X } from '...'` (separate statement) |

## Exports and imports

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| `export default` | names must be greppable; importers rename freely | `import/no-default-export`, `no-default-export` | `export function x` / `export const x`. Only `apps/*/app.config.ts`, config plugins in `packages/shell/plugins/` (tag `/** @public ... */` for knip) and Jest `__mocks__` default-export |
| `from '../x'` | predictable paths | `PARENT_IMPORT`, `no-parent-import` | same folder or below: `./x.ts`; any other folder: `@e07/<package>/<path-under-src>.ts` |
| `from './x'` without extension | Node type stripping needs it; with `"exports": { "./*": "./src/*" }` an extensionless package import does not resolve in `tsc` (verified) | `importExtension` selector, `import-extension` | `./x.ts`, `./view.tsx`, `./en.json` |
| barrel `index.ts`, re-exports for convenience | cycles, hidden dependencies | `check-file/filename-blocklist` | import the file that defines the symbol |
| import cycles | untestable coupling | `import/no-cycle` | move the shared type down (to game-kit or a types file) |
| deep `react-native/Libraries/*` | private API; a type error under the Strict API | `@react-native/no-deep-imports` | the public entry |
| Node built-ins (`node:*`, `fs`, `path`) in app code | they do not exist in the app runtime | `NODE_BUILTINS` | keep Node code in `packages/tooling`, `packages/shell/src/config`, `packages/shell/plugins` |

Import order is enforced and auto-fixed (`import/order`): built-ins, external packages, `@e07/*`, relative, then type imports in their own group, blank lines between groups. The PostToolUse hook runs `eslint --fix`, so imports are never ordered by hand.

## Promises, handlers and errors

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| floating promise, `void promise` | an unhandled rejection is a silent failure | `no-floating-promises` (`ignoreVoid: false`), `no-void-promise` | `await` it, `return` it, or `task().catch(reportError)` |
| `async` event handler (`onPress={async () => ...}`, `const handleBuy = async ...`) | RN's Strict API types `onPress` as returning `unknown`, so `no-misused-promises` cannot catch it (verified) | `asyncHandler` selector, `sync-handler` | `const handlePress = (): void => { onBuy().catch(reportError); };` (`examples/buy-button.tsx`) |
| empty `catch {}` | swallowed error; the local error log is the only trace (no crash reporting, N2) | `no-empty` (`allowEmptyCatch: false`), `no-empty-catch` | map to a `Result`, record through `ErrorLogPort` with a fallback, or rethrow with `{ cause }` |
| `throw 'text'` | loses the stack | `only-throw-error`, `throw-error-object` | `throw new Error('message', { cause })` |
| rejecting with a non-Error | same | `prefer-promise-reject-errors` | `reject(new Error(...))` |
| `async` Promise executor, `new Promise` around async code | swallowed rejections | `no-async-promise-executor` | plain `async` functions |
| `setTimeout(fn)` without a delay | unclear intent | `setTimeoutNoDelay` selector | an explicit delay, cleared in `finally` or an effect cleanup |

## Time, randomness and determinism

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| `Math.random()` | replays and daily seeds must match on every device | `no-restricted-properties` | the seeded RNG from `@e07/game-kit` (state stored in the game state) |
| `Date.now()`, `new Date()`, `performance.now()` in app code | testable time (test builds can set the date) | `no-restricted-properties`, `newDate` selector | inject `ClockPort`; the frame timestamp on the UI thread |
| `Date.now()`, `new Date()` in tooling | one testable clock | Node-code block | `packages/tooling/src/clock/system-clock.ts` |
| `Math.sin/cos/tan/atan2/exp/log/pow`, `**` in `packages/game-kit/src`, `apps/*/src/{rules,levels,sim,geom}` | Hermes uses the platform libm, Jest runs V8: results differ | `DETERMINISM_SYNTAX` | only `+ - * / %`, bitwise operators, `Math.sqrt/imul/floor/round/abs/min/max/PI`; multiply explicitly |
| `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `.toLocaleString()` and friends | Hermes applies the Persian calendar and ignores the digits setting | `intlDate`, `toLocaleCall` selectors | `t()`, the Shell's `createNumberFormatter` or `formatDayMonth` |

## Network and packages

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` in app code | spec N3: our code makes no network requests | `no-restricted-globals` | none; ads and store SDKs sit behind their ports |
| `http(s)://`, `ws(s)://`, `ftp://` literals in app code | remote images, fonts and downloads make requests without `fetch` | `remoteUrl*` selectors | OS links only in `packages/shell/src/config/external-links.ts` |
| `axios`, `@react-native-community/netinfo`, `react-native-webview`, `expo-web-browser`, `expo-updates` | network surfaces (NetInfo's probe calls Google) | `no-restricted-imports` | `ConnectivityPort` (expo-network); no OTA updates |
| `expo-router` | the Shell owns navigation (React Navigation 7 static API) | `no-restricted-imports` | the Shell's static stack |
| `expo-audio`, `expo-file-system`, `@react-native-async-storage/async-storage`, `react-native-iap`, `react-native-purchases`, `react-native-restart` | replaced by a decided port or banned by the spec | `no-restricted-imports` | `AudioPort`, `SaveStore`, `PurchasePort`; `reloadAppAsync` from `expo` |
| `expo-tracking-transparency` outside `packages/shell/src/services/consent/admob-consent-adapter.ts` | the App Tracking Transparency prompt is asked once, in order, by the consent adapter (owner decision O1: after the consent intro and Google's form, before any ad request) | `no-restricted-imports` (`ATT_IMPORT`; only the `ATT_ADAPTER` block lifts it) | `ConsentPort.requestTracking()` |
| a vendor SDK outside its adapter | one adapter per port | `no-restricted-imports` + the `ADAPTERS` block | import the port type; only `<vendor>-<port>-adapter.ts` imports the SDK |
| `console.log` in app code | no logging service | `no-console`, `no-console-log` | `ErrorLogPort` or the debug menu; `console.warn`/`error` are allowed |

## Text, direction and styles

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| JSX string literals; literal `accessibilityLabel`, `aria-label`, `accessibilityHint`, `placeholder`, `title`, `alt` | spec N12: every string is translatable | `react/jsx-no-literals`, `a11yLiteral`, `formatjs/no-literal-string-in-jsx` | `t('home.play-button.label')` |
| `Text` from `react-native` outside `AppText` | alignment and writing direction live in one component | `no-restricted-imports` | `AppText` from `@e07/shell/ui/app-text.tsx` |
| `left`, `right`, `marginLeft`, `paddingRight`, `borderTopLeftRadius`... in styles | spec N11: layouts mirror | `physicalStyleKeys` | `start`, `end`, `marginStart`, `paddingEnd`, `borderTopStartRadius` (data keys in game rules may say left/right) |
| `textAlign: 'left' \| 'right'` outside `AppText`; `flexDirection: 'row-reverse'` | React Native already mirrors | `textAlignLiteral`, `rowReverse` | `align='start' \| 'end'` on `AppText`; plain `row` |
| `I18nManager` outside `direction.ts` | one source of direction | `no-restricted-imports`, `no-restricted-properties` | `DirectionContext` |
| `react-intl` outside `packages/shell/src/i18n/` | the wrapper owns formatting, bidi isolation and digits | `no-restricted-imports` | `t()` / `<T>` |
| inline styles, color literals, unused styles, single-element style arrays | theme tokens only | `react-native/*` rules | `makeStyles(theme => ...)` with tokens |

## React and UI primitives

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| `useMemo`, `useCallback`, `React.memo` without a measured need | the React Compiler memoizes | `no-restricted-imports`, react-hooks compiler rules | plain code; `'use no memo'` only as the documented escape hatch |
| Reanimated `.value` | compiler-safe access | review | `.get()` / `.set()` |
| `Pressable` outside `packages/shell/src/ui`, or without `role` | one button family; spec 8.11 | `no-restricted-imports`, `pressableA11y` | the Shell buttons; every `Pressable` declares `role` and a translated label |
| `Image` outside the Icon component; `react-native-svg` | icons are code-drawn Skia paths (N9); SVG can fetch | `no-restricted-imports` | `Icon` from `@e07/shell/ui/icons/icon.tsx` |
| `Dimensions`, `Animated`, `Alert`, `SafeAreaView` from `react-native` | windows resize; Reanimated; Shell dialogs (S14); deprecated | `no-restricted-imports` | `useWindowDimensions`, `react-native-reanimated`, the Shell dialogs, `react-native-safe-area-context` |
| a store hook without a selector (`useSettingsStore()`) | re-renders on every change | `storeWithoutSelector` | `useSettingsStore((s) => s.theme)` |
| test globals (`jest`, `describe`, `expect`) in app code | tests stay in test files | `no-restricted-globals` | move the code into `*.test.ts(x)` |
| `@shopify/flash-list` | not installed | `no-restricted-imports` | `ScrollView` or `FlatList` |

## Tests

Test files (`**/*.test.{ts,tsx}`, `test/**`, `jest.setup.ts`, `__mocks__/**`) get block 7: 400 code lines, no per-function limit, 4 nested callbacks, `!` and unsafe `any` access allowed, JSX literals allowed. The Jest and Testing Library rules still hold:

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| `test(...)`, or `it` titles like `'should return'` | titles read as specifications | `jest/consistent-test-it`, `jest/valid-title` (`^(can\|[a-z]+s)\b`) | `it('returns ...')`, `it('can undo ...')` |
| an `it` outside a `describe` | one suite per unit | `jest/require-top-level-describe` | `describe('<exported name>', () => { it(...) })` |
| `toEqual` | `undefined` fields and class instances slip through | `jest/prefer-strict-equal` | `toStrictEqual` |
| `it.only`, `fit`, `it.skip`, `xit` | a focused or skipped test hides failures | `jest/no-focused-tests`, `jest/no-disabled-tests` | run the file with `npx jest <path>`; delete dead tests |
| a snapshot over 50 lines (inline over 10) | nobody reviews it | `jest/no-large-snapshots` (off only for `*.golden.test.ts`) | assert the fields that matter, or a golden test |
| a test with no assertion | proves nothing | `jest/expect-expect` (`expect`, `fc.assert`) | assert, or use `fc.assert` for properties |
| `fireEvent`/`userEvent` calls not awaited | RNTL 14 is async: `render`, `user.press`, `fireEvent` and `act` all return promises | `testing-library/await-async-events` | `const user = userEvent.setup();` then `await user.press(...)`; `await render(...)` |
| `fetch`, `WebSocket` in a test | tests never touch the network either | `no-restricted-globals` | a fake port |

## Comments

| Pattern | Why | Enforced by | Instead |
|---|---|---|---|
| `TODO`, `FIXME`, `XXX`, `HACK` comments | nothing comes back to them | `no-warning-comments`, `no-warning-comment` | do it now, or leave it out (git keeps history) |
| commented-out code | same | `sonarjs/no-commented-code` | delete it |
| a comment saying *what* the next line does | noise | review | comment *why*, citing the spec section when a line exists because of it |
