# 04 · Code style and limits

> **What this doc decides.** The complete TypeScript, ESLint and Prettier configuration for the monorepo (every file copy-pasteable and verified on 2026-09-26), the size and complexity limits with their rationale, and the house policies for comments, errors, async code, immutability, dependency injection and imports.
> Every rule here is an ESLint or `tsc` error, never a warning: `--max-warnings 0` everywhere, inline `eslint-disable` comments are switched off, and exceptions exist only as named blocks in `eslint.config.mjs`.
> Naming rules are in [03-naming.md](03-naming.md); how the gates run (scripts, hooks, CI, guardrail) is in [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md).
> **Related docs:** [03-naming.md](03-naming.md) (naming rules), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (how the gates run), [01-stack-and-versions.md](01-stack-and-versions.md) (versions), [02-architecture-and-folders.md](02-architecture-and-folders.md) (dependency boundaries and app zones), [05-components-hooks-styling.md](05-components-hooks-styling.md) (UI lint additions), [07-testing-and-tdd.md](07-testing-and-tdd.md) (test-file adjustments), [12-in-app-purchase.md](12-in-app-purchase.md) (the expo-iap adapter block). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

## Intro

No human reviews this code line by line, so style is enforced by machines or it does not exist. The configuration below turns the spec's non-negotiables into compile-time errors: N3 (no network in our code), N11 (no left/right in layout), N12 (every string translatable), determinism of game rules (spec 8.13, FINAL B.14), and the architecture boundaries (game-kit ← shell ← apps, FINAL A.8). Error messages quote the spec so the agent knows the fix.

The stack (binding, FINAL A.3 and D.34-D.37): TypeScript ~6.0.3 with a strict `tsconfig.base.json`; ESLint 9.39.5 flat config = `eslint-config-expo/flat` → typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` (projectService) → project rules → `eslint-config-prettier`; Prettier 3.9 as a separate check.

## Rules

1. **Keep every package and app on the shared strict `tsconfig.base.json`**; a workspace `tsconfig.json` may only set `types`, `lib`, `include` and `exclude`.
   *Why:* one set of compiler guarantees for all ~26 apps; the guardrail compares the resolved options (docs/16). *Source:* FINAL A.3.
2. **Code lives in one of two worlds and never mixes them.** App code (types `jest`, React Native) never imports a Node-world file, not even with `import type`; Node code (tooling, config composer, config plugins; types `node`) is never bundled into an app.
   *Why:* a type-only import still pulls the file into the app's program, where `process` and `node:fs` do not type-check (verified). *Enforced by:* `tsc` per project, `no-restricted-imports` (`node:*` banned in app code).
3. **Run ESLint only through the npm scripts** (`npm run lint`, `npm run check:fast`, the hooks); never pass `--rule`, `--no-inline-config` or `--no-eslintrc`-style overrides.
   *Why:* CLI flags bypass the config and the guardrail cannot see them. *Source:* [ESLint CLI](https://eslint.org/docs/latest/use/command-line-interface).
4. **Never write `eslint-disable`, `@ts-ignore` or `@ts-nocheck`.** `eslint-disable` comments have no effect (`noInlineConfig`) and are reported; `@ts-expect-error` needs a description of at least 10 characters and is allowed only where a third-party type is wrong.
   *Why:* the most likely failure of an unsupervised agent is silencing a check. *Enforced by:* `linterOptions`, `@typescript-eslint/ban-ts-comment`.
5. **Add an exception only as a `files`-scoped block in `eslint.config.mjs`,** with a comment naming the reason, and commit it with a `Gate-Change:` trailer. Rebuild the whole rule option list in that block from the shared lists.
   *Why:* in flat config a later block *replaces* a rule's options for the files it matches; it does not merge (verified). *Source:* [ESLint: configuration objects](https://eslint.org/docs/latest/use/configure/configuration-files#cascading-configuration-objects).
6. **Stay inside the limits table** (section 5): 250 lines per file, 40 lines per `.ts` function, 80 per `.tsx` component, cyclomatic 10 (modified), cognitive 15, depth 3, 3 parameters, 3 nested callbacks, JSX depth 5, one component and one class per file.
   *Why:* small units are read whole in one `Read` call and fail in one place. *Enforced by:* ESLint (section 5).
7. **When a limit trips, split by responsibility, never by line count:** extract a named pure function, a sub-component or a module with its own test. Never inline-compress code, join lines or move logic into JSON to get under a limit.
   *Why:* the limit is a symptom detector, not a target.
8. **Put large static data in `.json`** (level tables, word lists, palettes), not in `.ts`.
   *Why:* data is not logic; it has no line limit and loads without parsing TypeScript.
9. **Format only with Prettier** (`npm run format`), never by hand and never with an ESLint formatting plugin.
   *Source:* FINAL D.37; [Prettier rationale](https://prettier.io/docs/rationale).
10. **Return expected failures as values; throw only for programmer errors.** Expected = can happen in a correct program (illegal move, corrupt save, store offline, ad not loaded): return `Result<TValue, TError>` with a `kind` union, or `T | null` when absence is the only failure. Programmer error = a broken invariant or contract misuse: `throw new Error(message, { cause })`.
    *Why:* the type system then forces every caller to handle every expected case. *Enforced by:* `switch-exhaustiveness-check`, `only-throw-error`, review.
11. **Never swallow an error.** Every `catch` and every `.catch(...)` either maps the error to a `Result`/typed state, records it through `ErrorLogPort` and continues with a defined fallback, or rethrows with `cause`. Empty catch blocks are errors.
    *Why:* the spec has no crash reporting (N2); the local error log (spec 8.14) is the only trace. *Enforced by:* `no-empty`, `@typescript-eslint/no-floating-promises`, review.
12. **Never leave a promise floating.** Await it, return it, or end it with `.catch(reportError)`; `void promise` is not allowed.
    *Why:* an unhandled rejection is a silent failure. *Enforced by:* `@typescript-eslint/no-floating-promises` with `ignoreVoid: false`.
13. **Event handlers are synchronous.** A handler named `handleX`, or an inline function passed to an `on*` prop, is never `async`; it starts async work with `task().catch(reportError)`.
    *Why:* React Native's Strict TypeScript API types `onPress` as returning `unknown`, so `no-misused-promises` cannot catch async handlers (verified). *Enforced by:* `no-restricted-syntax` selector `asyncHandler`.
14. **Treat data as immutable:** `readonly` on every property and array type, `as const` for tables, updates return new objects, no parameter mutation. The only exceptions are typed arrays inside Reanimated shared values in `apps/*/src/sim/**` (FINAL B.13) and the caller-owned scratch buffers of `packages/game-kit/src/geom/spatial-hash.ts` (FINAL B.17, docs/08).
    *Enforced by:* `no-param-reassign` (`props: true`), `prefer-readonly`, `prefer-const`.
15. **Keep rules, levels and game-kit pure:** no React, React Native, Expo, Skia or Shell imports; no clock, randomness or I/O; the same inputs always give the same outputs.
    *Why:* bots, solvers, replays and daily challenges depend on it (spec 8.13). *Enforced by:* `no-restricted-imports` (`PURE`), `no-restricted-properties`, `no-restricted-syntax` (`DETERMINISTIC`).
16. **Use only exactly-rounded arithmetic in deterministic code** (`packages/game-kit/src/**`, `apps/*/src/{rules,levels,sim,geom}/**`): the operators `+ - * / %` and the bitwise operators (`| & ^ ~ << >> >>>`, which the integer PRNG needs), plus `Math.sqrt`, `Math.imul`, `Math.floor`, `Math.round`, `Math.abs`, `Math.min`, `Math.max` and `Math.PI`; no other `Math.*`, no `**`.
    *Why:* Hermes uses the platform libm and Jest runs V8, so transcendental results differ across devices (FINAL B.14).
17. **Inject dependencies; never reach for them.** Ports come from `ServicesProvider` (React Context) or are passed to factories; pure functions receive values (`nowMs`, `seed`), not services. No module-level singletons that touch native code, except inside an adapter (FINAL B.20's AudioContext).
    *Why:* every test swaps real adapters for `fake-<port>.ts` without module mocking. *Source:* FINAL A.5.
18. **Only the adapter file for a port imports its vendor SDK** (`react-native-google-mobile-ads`, `expo-iap`, `expo-sqlite`, `react-native-audio-api`, `expo-haptics`, `expo-network`). Apple's App Tracking Transparency module `expo-tracking-transparency` is imported by exactly one file, `packages/shell/src/services/consent/admob-consent-adapter.ts` (FINAL H.1, H.20).
    *Enforced by:* `no-restricted-imports` with the `ADAPTERS` exemption block, and for `expo-tracking-transparency` the file-exact `ATT_ADAPTER` block (`restrictedImports({ ..., allow: [ATT_IMPORT] })`); every other file, the other adapters included, keeps the ban.
19. **Import with explicit file extensions and never with `../`:** same folder or below `./x.ts`, `./asc/x.ts`; any other folder through the package name `@e07/<package>/<path-under-src>.ts(x)`.
    *Why:* Node type stripping (tooling, `app.config.ts`) requires extensions; with `"exports": { "./*": "./src/*" }` an extensionless package import does not even resolve in `tsc` (verified). *Enforced by:* `no-restricted-syntax` (`importExtension`), `no-restricted-imports` (`PARENT_IMPORT`).
20. **Respect the dependency direction** game-kit ← shell ← apps; tooling may import anything, nothing imports tooling.
    *Enforced by:* `no-restricted-imports` patterns `GAME_KIT_BOUNDARY`, `SHELL_BOUNDARY`, `NO_TOOLING`, `PURE_IMPORTS`; `import/no-cycle`.
21. **Named exports only;** `export default` only where a tool demands it (FINAL D.34): `apps/*/app.config.ts`, config plugins in `packages/shell/plugins/` (Expo loads a plugin named by path in `plugins: []` through its default export; tag that export `/** @public … */` so knip keeps it, docs/16) and Jest `__mocks__`, all exempted in the config.
    *Source:* [Google TS style guide, exports](https://google.github.io/styleguide/tsguide.html#exports).
22. **Every exported function, type and constant in `packages/game-kit`, every port type and every store has a one-sentence TSDoc summary** (`/** … */`) that states the contract or the reason, not a paraphrase of the code.
    *Why:* the agent reads summaries before bodies. *Enforced by:* review and the checklist.
23. **No commented-out code and no `TODO`/`FIXME`/`HACK` comments.**
    *Why:* nothing will come back to them; git keeps history. *Enforced by:* `sonarjs/no-commented-code`, `no-warning-comments`.

## Details

### 1. Versions (verified 2026-09-26)

[docs/01 section 3.2](01-stack-and-versions.md) is the source of truth for every version; this table repeats the lint, format and type subset with the notes that matter here.

| Package | Pin | Notes |
|---|---|---|
| typescript | 6.0.3 | Expo SDK 57 range `~6.0.3`, saved exact; npm `latest` is 7.0.2, but typescript-eslint 8.70.1 supports `>=4.8.4 <6.1.0` |
| eslint | 9.39.5 | `maintenance` tag; ESLint 10 breaks eslint-plugin-react used by eslint-config-expo 57 (ESLint 9 is EOL since 2026-08-06; dev-only) |
| eslint-config-expo | 57.0.2 | brings eslint-plugin-import 2.32.0, eslint-plugin-react-hooks 7.1.1 (React Compiler rules), eslint-import-resolver-typescript; these are the resolved versions of its `^2.30.0` / `^7.0.0` ranges, held by the lockfile |
| typescript-eslint | 8.70.1 | |
| eslint-plugin-sonarjs | 4.2.1 | LGPL-3.0-only, dev-only (never shipped) |
| eslint-plugin-react-native | 5.0.0 | last release Dec 2024; peer ≤ ESLint 9 |
| @react-native/eslint-plugin | 0.86.3 | match the react-native version |
| eslint-plugin-check-file | 3.3.2 | |
| eslint-plugin-jest | 29.16.6 | |
| eslint-plugin-testing-library | 7.16.2 | |
| eslint-plugin-formatjs | 8.1.0 | only `no-literal-string-in-jsx` (FINAL C.28) |
| eslint-config-prettier | 10.1.8 | |
| globals | 17.12.0 | Node globals for `*.config.js` files |
| prettier | 3.9.9 | younger than the 7-day `min-release-age` on 2026-09-26; covered by docs/01's dated bootstrap exclude until 2026-10-03 |
| @types/node | 26.4.1 | matches the Node 26.4 runtime (docs/01); the verification below ran with 26.6.3 installed |

Install (from the repo root; `.npmrc` sets `save-exact=true`, see docs/01):

```sh
npm install -D eslint@9.39.5 typescript-eslint@8.70.1 eslint-plugin-sonarjs@4.2.1 \
  eslint-plugin-react-native@5.0.0 @react-native/eslint-plugin@0.86.3 eslint-plugin-check-file@3.3.2 \
  eslint-plugin-jest@29.16.6 eslint-plugin-testing-library@7.16.2 eslint-plugin-formatjs@8.1.0 \
  eslint-config-prettier@10.1.8 globals@17.12.0 prettier@3.9.9 @types/node@26.4.1 \
  typescript@6.0.3 eslint-config-expo@57.0.2
```

Re-verify before relying on these numbers: `npm view <package> version` and `npm view <package> time --json` for each row, `npx expo install --check` in every app, then `npm run verify`. Upgrade triggers: ESLint 10 only when eslint-config-expo declares support (watch its eslint-plugin-react dependency and jsx-eslint/eslint-plugin-react PR #4022); TypeScript 7 only when typescript-eslint supports it (tracking issue #10940).

### 2. TypeScript configuration

#### 2.1 Two worlds, six files

| File | World | `types` | Covers |
|---|---|---|---|
| `tsconfig.base.json` | shared | `[]` | compiler options only |
| `tsconfig.json` (root) | tests + Node-side config | `jest`, `node` | `jest.setup.ts`, `__mocks__/**`, `test/**`, `apps/*/app.config.ts`, `packages/shell/src/config/**`, `packages/shell/plugins/**` |
| `packages/game-kit/tsconfig.json` | app (pure) | `jest`, `lib: ESNext` only | `src/**` |
| `packages/shell/tsconfig.json` | app | `jest` | `src/**` except `src/config/**` |
| `apps/<game-id>/tsconfig.json` | app | `jest` | `index.ts`, `game.config.ts`, `src/**`, the Shell's `app-env.d.ts` |
| `packages/tooling/tsconfig.json` | Node | `node`, `jest` | `src/**` |

How the files are found:

- **`tsc`** checks each file list separately: `npm run typecheck` runs `tsc -p tsconfig.json` and then `tsc -p` for every `packages/*` and `apps/*` folder (docs/16). `incremental` with a build-info file under each project's `node_modules/.cache/tsc/` makes the second run take about 0.5 s per project.
- **ESLint's projectService** (and the editor) picks the nearest `tsconfig.json` that includes the file. Since TypeScript 5.7 it keeps walking up when the nearest one excludes the file, which is how `packages/shell/src/config/**`, `packages/shell/plugins/**` and `apps/*/app.config.ts` reach the root `tsconfig.json` (verified with TypeScript 6.0.3 and typescript-eslint 8.70.1). *Source:* [TypeScript 5.7: searching ancestor configuration files](https://devblogs.microsoft.com/typescript/announcing-typescript-5-7/).
- **Expo CLI** needs `apps/<game-id>/tsconfig.json`. Do not add `expo-env.d.ts` or `.expo/types` to its `include`: `expo/types` augments React Native with react-native-web style props and breaks `TextStyle` under the Strict TypeScript API (verified: TS2559 in `app-text.tsx`). Keep `expo-env.d.ts` gitignored and out of every program.

Neutral files. A few files are read by both worlds (for example `packages/shell/src/config/game-config.ts` holds only the `GameConfig` type, and `app-variant.ts` holds a pure parser). They import nothing from Node or React Native, so either program can check them. `game.config.ts` in an app imports the type from `@e07/shell/config/game-config.ts`, never from `with-shell.ts`.

#### 2.2 The files

```jsonc
// tsconfig.base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "erasableSyntaxOnly": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "useUnknownInCatchVariables": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "forceConsistentCasingInFileNames": true,
    "noErrorTruncation": true,
    "incremental": true,
    "tsBuildInfoFile": "${configDir}/node_modules/.cache/tsc/tsbuildinfo.json",
    "customConditions": ["react-native-strict-api", "react-native"],
    "types": []
  }
}
```

```jsonc
// tsconfig.json (repo root: tests and Node-side config)
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "types": ["jest", "node"]
  },
  "include": [
    "jest.setup.ts",
    "__mocks__/**/*",
    "test/**/*",
    "apps/*/app.config.ts",
    "packages/shell/src/config/**/*",
    "packages/shell/plugins/**/*"
  ]
}
```

```jsonc
// packages/game-kit/tsconfig.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ESNext"],
    "types": ["jest"]
  },
  "include": ["src/**/*"]
}
```

```jsonc
// packages/shell/tsconfig.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["src/config/**/*"]
}
```

```jsonc
// apps/line-siege/tsconfig.json (same for every app)
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["jest"]
  },
  "include": ["index.ts", "game.config.ts", "src/**/*", "../../packages/shell/src/app-env.d.ts"]
}
```

```jsonc
// packages/tooling/tsconfig.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ESNext"],
    "types": ["node", "jest"]
  },
  "include": ["src/**/*"]
}
```

(The first comment line in each block is the path for the reader; the files themselves start with `{`.)

What the options buy, in one line each:

| Option | What it catches |
|---|---|
| `strict` | the baseline: `strictNullChecks`, `noImplicitAny`, and the rest |
| `noUncheckedIndexedAccess` | `board[row][col]` is `T \| undefined`, so out-of-bounds grid reads must be handled |
| `exactOptionalPropertyTypes` | a missing save field differs from one set to `undefined` (N10); pass optional props with a conditional spread: `{...(testID === undefined ? {} : { testID })}` |
| `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch` | forgotten `override`, missing `return`, silent `case` fall-through |
| `noPropertyAccessFromIndexSignature` | `record.key` on an index signature must be `record['key']`; declared `EXPO_PUBLIC_*` variables keep dot access |
| `erasableSyntaxOnly` | no `enum`, `namespace` or constructor parameter properties; keeps every file runnable by Node type stripping |
| `verbatimModuleSyntax`, `isolatedModules` | `import type` for types, required by Babel/Metro single-file transforms |
| `allowImportingTsExtensions` | `./x.ts` imports (rule 19); allowed because `noEmit` is set by `expo/tsconfig.base` |
| `useUnknownInCatchVariables` | `catch (error)` is `unknown`; narrow before use |
| `allowUnreachableCode: false`, `allowUnusedLabels: false`, `forceConsistentCasingInFileNames` | dead code, stray labels, case-only import mismatches |
| `noErrorTruncation` | full types in error messages, so the agent sees the whole mismatch |
| `customConditions: ["react-native-strict-api", "react-native"]` | React Native's Strict TypeScript API (default from RN 0.87); overriding replaces the base array, so `react-native` must stay |
| `types` | TS 6 defaults to `[]`; each world lists exactly what it may use |

TypeScript does not report unused locals or parameters (`noUnusedLocals`/`noUnusedParameters` stay off); ESLint's `@typescript-eslint/no-unused-vars` owns that, so there is one reporter and `_`-prefixed parameters work.

`process.env` in app code: Expo inlines `EXPO_PUBLIC_*` variables only for dot access, so each one is declared. App programs have no `@types/node`, so the file also declares `process`, and every app tsconfig lists it in `include`: an app program type-checks the Shell files it imports, and without the entry `tsc -p apps/<game-id>` fails with TS2591 `Cannot find name 'process'` (verified). Keep it out of the root (Node) program: there it silently replaces `@types/node`'s `process` (`skipLibCheck` hides the clash) and `process.exitCode` fails with TS2339 (verified):

```ts
// packages/shell/src/app-env.d.ts
// Expo inlines EXPO_PUBLIC_* only when read with dot access, so each one is declared here.
// App programs load neither @types/node nor expo-env.d.ts, so `process` is declared too (docs/14).
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_APP_VARIANT?: 'test' | 'store';
  }
}
declare const process: { readonly env: NodeJS.ProcessEnv };
```

#### 2.3 Node-world rules (tooling, config composer, config plugins)

Node 26 runs `.ts` files directly by stripping types (FINAL A.8 requires engines `>=22.18` for this). That imposes five rules on every file in `packages/tooling`, `packages/shell/src/config` and `packages/shell/plugins`:

1. Relative imports carry the `.ts` extension; Node ignores tsconfig `paths`, so no aliases.
2. Only erasable TypeScript syntax (guaranteed by `erasableSyntaxOnly`).
3. The package declares `"type": "module"` (the tooling, shell and game-kit `package.json` files do) so Node does not warn `MODULE_TYPELESS_PACKAGE_JSON`.
4. Keep testable logic in pure modules without top-level side effects (for example `commit-message-rules.ts`); the CLI file wraps it and sets `process.exitCode`. Jest transforms these modules with Babel, so pure modules must not use `import.meta`.
5. A deep import into a package that has no `exports` map needs the file's `.js` extension under Node ESM: config plugins import `expo/config-plugins.js`, not `expo/config-plugins` (verified: `npx expo config` fails with `ERR_MODULE_NOT_FOUND … Did you mean to import "expo/config-plugins.js"?` and succeeds with the extension). Type-only imports (`import type { ExpoConfig } from 'expo/config'`) are erased and need nothing.

*Source:* [Node.js: TypeScript type stripping](https://nodejs.org/api/typescript.html).

### 3. ESLint: the complete `eslint.config.mjs`

Blocks, in order (later blocks override earlier ones for the files they match):

| Block | Files | Purpose |
|---|---|---|
| ignores | generated folders | `ios/`, `android/`, `.expo/`, reports, tools |
| 0 | all | `noInlineConfig`, unused-directive errors |
| 1 | all | `eslint-config-expo/flat`, plugins, TypeScript import resolver |
| 2 | `**/*.{ts,tsx}` | typescript-eslint strict + stylistic (type-aware), naming, promises, comments |
| 3 | `**/*.{ts,tsx}` | size and complexity limits (80 lines for `.tsx`) |
| 4 | `**/*.{ts,tsx}` | exports, import order and cycles, banned packages, `../` ban, file names |
| 5 | `RUNTIME` | N3 network, clock and randomness, RTL styles, i18n, vendor SDKs, UI primitives and memo (docs/05), store hooks need a selector, RN rules |
| 5 (shell), 5-zones, 5-i18n / 5a / 5b | shell, app sources, `.tsx` sources, `PURE`, `DETERMINISTIC` | dependency direction, app zones on resolved paths (docs/02), FormatJS JSX text and props (only the Shell i18n folder imports `react-intl`), purity, integer-safe math |
| 5c | named files | the only exemptions: sims and the spatial hash, adapters (the purchase adapter still may not import expo-iap's server APIs, docs/12), the ATT adapter (`admob-consent-adapter.ts`, the one importer of `expo-tracking-transparency`, FINAL H.1), clock adapter, direction module, raw `Pressable` in `ui/` and raw `Image` in `Icon` (docs/05), the perf clock files (docs/15), `AppText`, the test-only loader, external links |
| 6 | `NODE_CODE` | Node APIs, network and console allowed in tooling and config; the wall clock only in `packages/tooling/src/clock/system-clock.ts`; default exports in `app.config.ts` and config plugins |
| 7 | `TESTS` | Jest, Testing Library, relaxed limits, `.d.ts` merging, mocks (default export and PascalCase names, docs/07) |
| 8 | JS config files | Node globals, no type information |
| 9 | all | `eslint-config-prettier` last |

```js
// eslint.config.mjs: the ONE ESLint config for the whole monorepo (ESLint 9 flat config).
// Owned by docs/04-code-style-and-limits.md. Changing it needs a `Gate-Change:` commit trailer.
// Exceptions live in this file only: inline eslint-disable comments are switched off (block 0).
// Rules owned by other docs are merged here: docs/05 (UI), docs/02 (app zones), docs/12 (expo-iap)
// and docs/07 (__mocks__ names). Those docs point to this file; they hold no copies.
// @ts-check
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import reactNativeOfficial from '@react-native/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import checkFile from 'eslint-plugin-check-file';
import formatjs from 'eslint-plugin-formatjs';
import globals from 'globals';
import jestPlugin from 'eslint-plugin-jest';
import reactNative from 'eslint-plugin-react-native';
import sonarjs from 'eslint-plugin-sonarjs';
import testingLibrary from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';

// ---------------------------------------------------------------------------------------------
// File groups (canonical repo layout, docs/04 section "File groups").
// ---------------------------------------------------------------------------------------------
const ALL_TS = ['**/*.{ts,tsx}'];
/** Code that ships inside an app bundle. */
const RUNTIME = [
  'apps/*/index.ts',
  'apps/*/game.config.ts',
  'apps/*/src/**/*.{ts,tsx}',
  'packages/game-kit/src/**/*.ts',
  'packages/shell/src/**/*.{ts,tsx}',
];
/** Code that runs in Node: build scripts, config composer, config plugins. */
const NODE_CODE = [
  'apps/*/app.config.ts',
  'packages/shell/src/config/**/*.ts',
  'packages/shell/plugins/**/*.ts',
  'packages/tooling/src/**/*.ts',
];
/** Pure TypeScript: no React, React Native, Expo, Skia or Shell imports. */
const PURE = ['packages/game-kit/src/**/*.ts', 'apps/*/src/{rules,levels}/**/*.ts'];
/** Deterministic code: replays and daily seeds must match on every device (FINAL B.14). */
const DETERMINISTIC = [
  'packages/game-kit/src/**/*.ts',
  'apps/*/src/{rules,levels,sim,geom}/**/*.ts',
];
const TESTS = [
  '**/*.test.{ts,tsx}',
  'test/**/*.{ts,tsx}',
  'jest.setup.ts',
  '__mocks__/**/*.{ts,tsx}',
];
const GOLDEN_TESTS = ['**/*.golden.test.ts'];
/** Plain JS config files (babel, jest, metro, eslint itself). */
const JS_CONFIG = ['*.{js,cjs,mjs}', 'apps/*/*.{js,cjs,mjs}', 'packages/*/*.{js,cjs,mjs}'];
/** The only files allowed to import a vendor SDK (one adapter per port, FINAL C.23-C.27). */
const ADAPTERS = [
  'packages/shell/src/services/*/*-adapter.ts',
  'packages/shell/src/services/*/*-save-store.ts',
  'packages/shell/src/services/*/*-sql-driver.ts',
];
const CLOCK_ADAPTERS = ['packages/shell/src/services/clock/*-adapter.ts'];
/** The one file that asks for App Tracking Transparency (ConsentPort.requestTracking; FINAL H.1). */
const ATT_ADAPTER = ['packages/shell/src/services/consent/admob-consent-adapter.ts'];
const DIRECTION_MODULE = ['packages/shell/src/i18n/direction.ts'];
const APP_TEXT = ['packages/shell/src/ui/app-text.tsx'];

// docs/02 section 5.3: app zones on resolved paths (block 5-zones).
const ROOT = import.meta.dirname;
const APPS_DIR = resolve(ROOT, 'apps');
// Guarded: the scaffold commits this file before the first app exists (docs/17).
const APP_IDS = existsSync(APPS_DIR)
  ? readdirSync(APPS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
// Game code may use these Shell folders only (types and hooks built for games). The synth is
// pure and game recipe tests call synthesizeRecipe (docs/09); messages.ts holds asGameKey,
// which a game's typed key table uses (docs/10).
const GAME_FACING = [
  './game-host',
  './art',
  './i18n/messages.ts',
  './services/audio/audio-port.ts',
  './services/audio/synth',
  './theme/theme-types.ts',
];

// ---------------------------------------------------------------------------------------------
// Shared option lists. A later flat-config block REPLACES a rule's options for the files it
// matches (no merging), so every block that narrows a rule rebuilds it from these lists.
// ---------------------------------------------------------------------------------------------
const N3 = 'Spec N3: our code makes no network requests.';
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
  name,
  message: N3,
}));
const TEST_GLOBALS = ['jest', 'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach'].map(
  (name) => ({ name, message: 'Test globals belong in *.test.ts(x) files only.' }),
);

const RESTRICTED_PROPERTIES = [
  { object: 'Math', property: 'random', message: 'Use the seeded RNG from @e07/game-kit.' },
  { object: 'Date', property: 'now', message: 'Inject ClockPort (spec S15 set-date).' },
  { object: 'performance', property: 'now', message: 'Use the frame timestamp or ClockPort.' },
  { object: 'I18nManager', property: 'isRTL', message: 'Read direction from DirectionContext.' },
];
// Node code (tooling, config) reads the wall clock in one module only (docs/01, docs/14).
const WALL_CLOCK = 'Read the wall clock only in packages/tooling/src/clock/system-clock.ts.';
const NODE_CLOCK_PROPERTIES = [{ object: 'Date', property: 'now', message: WALL_CLOCK }];
const NODE_NEW_DATE = {
  selector: "NewExpression[callee.name='Date'][arguments.length=0]",
  message: WALL_CLOCK,
};
const withoutProperty = (object, property) =>
  RESTRICTED_PROPERTIES.filter(
    (entry) => !(entry.object === object && entry.property === property),
  );

const vendor = (name, port) => ({
  name,
  message: `Only the ${port} adapter in packages/shell/src/services/ may import ${name}.`,
});
const VENDOR_SDK_PATHS = [
  vendor('react-native-google-mobile-ads', 'AdsPort/ConsentPort'),
  vendor('expo-iap', 'PurchasePort'),
  vendor('expo-sqlite', 'SaveStore/SqlDriver'),
  vendor('react-native-audio-api', 'AudioPort'),
  vendor('expo-haptics', 'HapticsPort'),
  vendor('expo-network', 'ConnectivityPort'),
];
const banned = (name, message) => ({ name, message });
// FINAL H.1 (owner O1): the app asks for App Tracking Transparency before any ad request that could
// use the IDFA, and only the consent adapter does (every other file, other adapters included, keeps
// this ban; the ATT_ADAPTER block lifts it for that one file).
const ATT_IMPORT = banned(
  'expo-tracking-transparency',
  'Only packages/shell/src/services/consent/admob-consent-adapter.ts asks for tracking (ConsentPort).',
);
const BANNED_PACKAGE_PATHS = [
  banned('axios', N3),
  banned(
    '@react-native-community/netinfo',
    'Its reachability probe calls Google (N3). Use ConnectivityPort.',
  ),
  banned('expo-updates', 'No OTA updates (N3). Restart with reloadAppAsync from expo.'),
  banned('expo-router', 'The Shell owns navigation (React Navigation static API, FINAL A.4).'),
  banned('expo-audio', 'Sound goes through AudioPort (react-native-audio-api, FINAL B.20).'),
  banned('expo-file-system', 'Persist through SaveStore (expo-sqlite, FINAL A.6).'),
  banned('expo-web-browser', 'WebViews and browsers are network surfaces (N3).'),
  banned('react-native-webview', 'WebViews are network surfaces (N3).'),
  banned('@react-native-async-storage/async-storage', 'Persist through SaveStore (FINAL A.6).'),
  banned('react-native-iap', 'IAP goes through PurchasePort (expo-iap, FINAL C.25).'),
  banned('react-native-purchases', 'No purchase server (N2).'),
  ATT_IMPORT,
  banned('react-native-restart', 'Use reloadAppAsync from expo (FINAL C.31).'),
  {
    name: 'react-native',
    importNames: ['Alert'],
    message: 'Use the Shell dialogs (spec S14).',
  },
  {
    name: 'react-native',
    importNames: ['SafeAreaView'],
    message: 'Use react-native-safe-area-context.',
  },
];
const TEXT_IMPORT = {
  name: 'react-native',
  importNames: ['Text'],
  message: 'Render text with AppText from @e07/shell/ui/app-text.tsx (spec N11, FINAL A.7).',
};
const I18N_MANAGER_IMPORT = {
  name: 'react-native',
  importNames: ['I18nManager'],
  message: 'Only packages/shell/src/i18n/direction.ts touches I18nManager (FINAL C.31).',
};
const PARENT_IMPORT = {
  group: ['../*', '../../*', '../../../*', '../../../../*'],
  message: 'No parent-relative imports: use ./sibling.ts or the package name (@e07/shell/...).',
};
const NODE_BUILTINS = {
  group: ['node:*', 'fs', 'path', 'child_process', 'os', 'crypto', 'http', 'https', 'net'],
  message: 'Node built-ins do not exist in the app runtime.',
};
const NO_TOOLING = {
  group: ['@e07/tooling', '@e07/tooling/**'],
  message: 'Tooling is Node-only build code; the app never imports it.',
};
const SHELL_BOUNDARY = {
  group: ['@e07/**', '!@e07/shell', '!@e07/shell/**', '!@e07/game-kit', '!@e07/game-kit/**'],
  message: 'The Shell imports only @e07/shell/* and @e07/game-kit/*, never an app (spec N5).',
};
const GAME_KIT_BOUNDARY = {
  group: ['@e07/**', '!@e07/game-kit', '!@e07/game-kit/**'],
  message: 'game-kit is the bottom layer: it imports only itself.',
};
const PURE_IMPORTS = {
  group: [
    'react',
    'react/*',
    'react-native',
    'react-native-*',
    'react-native/*',
    '@react-native/*',
    'expo',
    'expo-*',
    '@expo/*',
    '@shopify/*',
    '@e07/shell',
    '@e07/shell/*',
    'zustand',
    'zustand/*',
  ],
  message:
    'Rules, levels and game-kit are pure TypeScript: import only @e07/game-kit/* and siblings.',
};

// `allow` lifts a banned package for one file-exact block (the ATT adapter); nothing else does.
const restrictedImports = ({ paths = [], patterns = [], allow = [] }) => [
  'error',
  {
    paths: [...without(BANNED_PACKAGE_PATHS, ...allow), ...paths],
    patterns: [PARENT_IMPORT, ...patterns],
  },
];
const REACT_INTL_IMPORT = {
  name: 'react-intl',
  message: 'Use t() / <T> from packages/shell/src/i18n (FINAL C.28), never react-intl directly.',
};
// docs/05 and docs/15: UI primitives, compiler-era memo, deprecated/unsupported APIs.
const rn = (name, message) => ({ name: 'react-native', importNames: [name], message });
const PRESSABLE_IMPORT = rn(
  'Pressable',
  'Use the Shell buttons in packages/shell/src/ui (docs/05).',
);
const IMAGE_IMPORT = rn(
  'Image',
  'Icons come from Icon in @e07/shell/ui/icons/icon.tsx (docs/05, N9).',
);
const UI_PATHS = [
  PRESSABLE_IMPORT,
  IMAGE_IMPORT,
  rn('Dimensions', 'Use useWindowDimensions: windows resize on iPad and iOS 27 (docs/05).'),
  rn('Animated', 'Use react-native-reanimated (docs/05).'),
  {
    name: 'react',
    importNames: ['useMemo', 'useCallback', 'memo'],
    message: 'React Compiler memoizes; a hand-written memo needs a measured reason (docs/05).',
  },
  banned('react-native-svg', 'Icons are Skia paths rasterized by Icon (docs/05); N3 fetch path.'),
  banned('@shopify/flash-list', 'Not installed: ScrollView or FlatList (docs/05).'),
];
const RUNTIME_PATHS = [
  ...VENDOR_SDK_PATHS,
  TEXT_IMPORT,
  I18N_MANAGER_IMPORT,
  REACT_INTL_IMPORT,
  ...UI_PATHS,
];
// Every block that narrows no-restricted-imports starts from RUNTIME_PATHS minus its exemptions.
const without = (paths, ...removed) => paths.filter((entry) => !removed.includes(entry));
// Port types (`*-port.ts`) stay importable: a ui/ component may receive a port as a prop (docs/11).
// Match files, not folders: a negation cannot re-include a file under an excluded folder.
const UI_BOUNDARY = {
  group: [
    '@e07/shell/stores/*',
    '@e07/shell/screens/*',
    '@e07/shell/services/*/*',
    '!@e07/shell/services/*/*-port.ts',
  ],
  message: 'packages/shell/src/ui is presentational: data arrives through props (docs/05).',
};
// docs/15: the only app files that read the wall clock or performance.now (test builds only).
const PERF_CLOCK_FILES = [
  'packages/shell/src/app/perf/cold-start.ts',
  'packages/shell/src/app/perf/use-cold-start-mark.ts',
  'packages/shell/src/app/perf/save-benchmark.ts',
];
const PERF_PROPERTIES = RESTRICTED_PROPERTIES.filter(
  (entry) => entry.object !== 'Date' && entry.object !== 'performance',
);
// docs/12 rule 3: server features and hidden finishing stay banned inside the purchase adapter.
const EXPO_IAP_SERVER_APIS = {
  name: 'expo-iap',
  importNames: ['kitApi', 'KitApiError', 'verifyPurchaseWithProvider', 'verifyPurchase', 'useIAP'],
  message: 'Server features and hidden finishing are banned (docs/12 rule 3).',
};
const RUNTIME_IMPORTS = restrictedImports({
  paths: RUNTIME_PATHS,
  patterns: [NODE_BUILTINS, NO_TOOLING],
});

// Physical-direction style keys (spec N11), only inside style contexts: game rules may use
// `left`/`right` as data. Verified selector (review-qt-b, 2026-09-26).
const PHYSICAL_KEYS =
  '/^(left|right|marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderLeftColor|borderRightColor|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)$/';
const STYLE_CONTEXT =
  ":matches(CallExpression[callee.object.name='StyleSheet'][callee.property.name='create'], JSXAttribute[name.name=/[sS]tyle$/], VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.name=/Style$/])";
const KEBAB = '[a-z0-9]+(-[a-z0-9]+)*';

const SYNTAX = {
  physicalStyleKeys: {
    selector: `${STYLE_CONTEXT} Property[key.name=${PHYSICAL_KEYS}]`,
    message: 'Spec N11: use start/end (marginStart, paddingEnd, start, end), never left/right.',
  },
  textAlignLiteral: {
    selector: "Property[key.name='textAlign'][value.value=/^(left|right)$/]",
    message: "Spec N11: pass align='start'|'end' to AppText instead of textAlign left/right.",
  },
  rowReverse: {
    selector: "Property[key.name='flexDirection'][value.value='row-reverse']",
    message: 'Spec N11: row already mirrors in RTL; row-reverse double-flips.',
  },
  enums: {
    selector: 'TSEnumDeclaration',
    message: 'No enums: use a string-literal union from an `as const` array.',
  },
  remoteUrl: {
    selector: 'Literal[value=/^(https?|wss?|ftp):\\/\\//i]',
    message:
      'Spec N3: no remote URLs in app code. OS links live in packages/shell/src/config/external-links.ts.',
  },
  remoteUrlTemplate: {
    selector: 'TemplateElement[value.raw=/^(https?|wss?|ftp):\\/\\//i]',
    message: 'Spec N3: no remote URLs in app code.',
  },
  newDate: {
    selector: "NewExpression[callee.name='Date']",
    message: 'Inject ClockPort; format dates with the Shell date formatter (FINAL C.29).',
  },
  intlDate: {
    selector:
      "MemberExpression[object.name='Intl'][property.name=/^(DateTimeFormat|RelativeTimeFormat)$/]",
    message: 'Hermes calendars differ per locale (FINAL C.29): use the Shell date formatter.',
  },
  toLocaleCall: {
    selector: 'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]',
    message:
      'FINAL C.29: Hermes ignores the digits setting; use t(), createNumberFormatter or formatDayMonth.',
  },
  setTimeoutNoDelay: {
    selector: "CallExpression[callee.name='setTimeout'][arguments.length<2]",
    message: 'Pass an explicit delay.',
  },
  a11yLiteral: {
    selector:
      'JSXAttribute[name.name=/^(aria-label|accessibilityLabel|accessibilityHint|placeholder|title|alt)$/] > Literal',
    message: 'Spec N12: user-facing text props come from t().',
  },
  testIdFormat: {
    selector: `JSXAttribute[name.name='testID'] > Literal[value!=/^${KEBAB}(\\.${KEBAB})+$/]`,
    message: "testID is '<screen>.<element>' in kebab-case, e.g. 'home.play-button' (docs/03).",
  },
  kindValue: {
    selector: `Property[key.name=/^(kind|type)$/] > Literal[value=/[^a-z0-9-]/]`,
    message:
      "`kind`/`type` values are kebab-case string literals, e.g. 'column-cleared' (docs/03).",
  },
  kindTypeValue: {
    selector: `TSPropertySignature[key.name=/^(kind|type)$/] TSLiteralType > Literal[value=/[^a-z0-9-]/]`,
    message:
      "`kind`/`type` values are kebab-case string literals, e.g. 'column-cleared' (docs/03).",
  },
  asyncHandler: {
    selector:
      'JSXAttribute[name.name=/^on[A-Z]/] > JSXExpressionContainer > :function[async=true], VariableDeclarator[id.name=/^handle[A-Z]/] > :function[async=true], FunctionDeclaration[async=true][id.name=/^handle[A-Z]/]',
    message:
      'Event handlers are synchronous: start async work with `task().catch(reportError)` (docs/04).',
  },
  importExtension: {
    selector:
      ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^(\\.|@e07\\/)/][source.value!=/\\.(ts|tsx|json)$/]',
    message:
      'Write the file extension (./x.ts, @e07/shell/ui/app-text.tsx): Node type stripping needs it.',
  },
  pressableA11y: {
    selector:
      "JSXOpeningElement[name.name='Pressable']:not(:has(JSXAttribute[name.name=/^(accessibilityRole|role)$/]))",
    message: 'Spec 8.11: every Pressable declares role (and a label from t()).',
  },
  storeWithoutSelector: {
    selector:
      ":matches(CallExpression[callee.name=/^use[A-Z][A-Za-z]*Store$/][arguments.length=0], CallExpression[callee.name='useStore'][arguments.length<2])",
    message: 'Pass a selector to the store hook: a bare call re-renders on every change (docs/05).',
  },
};
const DETERMINISM_SYNTAX = [
  {
    selector:
      "MemberExpression[object.name='Math'][property.name!=/^(sqrt|imul|floor|round|abs|min|max|PI)$/]",
    message:
      'FINAL B.14: deterministic code uses only + - * /, sqrt, imul, floor, round, abs, min, max.',
  },
  {
    selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
    message: 'FINAL B.14: ** is Math.pow; multiply explicitly.',
  },
];
const runtimeSyntax = (omit = []) => [
  'error',
  ...Object.entries(SYNTAX)
    .filter(([key]) => !omit.includes(key))
    .map(([, value]) => value),
];

const BOOLEAN_PREFIXES = ['is', 'has', 'can', 'should', 'did', 'will', 'was'];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.expo/**',
    'apps/*/ios/**',
    'apps/*/android/**',
    'apps/*/build/**',
    'apps/*/dist/**',
    'coverage/**',
    'reports/**',
    'dist-audit/**',
    'tools/**',
    '.stryker-tmp/**',
    '**/expo-env.d.ts',
  ]),

  // 0. No inline eslint-disable comments anywhere; unused exceptions are errors.
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },

  // 1. Expo base: import, react, react-hooks (React Compiler rules) and expo rules.
  expoConfig,
  {
    plugins: {
      sonarjs,
      'react-native': reactNative,
      '@react-native': reactNativeOfficial,
      'check-file': checkFile,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json', 'packages/*/tsconfig.json', 'apps/*/tsconfig.json'],
        },
        node: true,
      },
    },
    rules: { 'import/no-named-as-default-member': 'off' },
  },

  // 2. Type-aware TypeScript rules.
  {
    files: ALL_TS,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'all', argsIgnorePattern: '^_', caughtErrors: 'all', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowString: false, allowNumber: false, allowNullableObject: true },
      ],
      '@typescript-eslint/no-floating-promises': [
        'error',
        { ignoreVoid: false, ignoreIIFE: false },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-async-promise-executor': 'error',
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'start' },
      ],
      'sonarjs/no-commented-code': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        // React components are PascalCase functions.
        { selector: 'variable', types: ['function'], format: ['camelCase', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase', 'UPPER_CASE'],
          prefix: [...BOOLEAN_PREFIXES, ...BOOLEAN_PREFIXES.map((p) => `${p.toUpperCase()}_`)],
        },
        { selector: 'variable', modifiers: ['destructured'], format: null },
        { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
        {
          selector: 'parameter',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: BOOLEAN_PREFIXES,
          leadingUnderscore: 'allow',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          custom: { regex: '^(T|T[A-Z][A-Za-z]+)$', match: true },
        },
        // Object keys may mirror external APIs, style props or catalog keys.
        { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
      ],
    },
  },

  // 3. Size and complexity limits (docs/04 "Limits").
  {
    files: ALL_TS,
    rules: {
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ['error', { max: 10, variant: 'modified' }],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 3],
      'max-params': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-classes-per-file': ['error', 1],
      'react/jsx-max-depth': ['error', { max: 5 }],
      'react/no-multi-comp': ['error', { ignoreStateless: false }],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-nested-conditional': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': [
        'error',
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },

  // 4. Rules for every TypeScript file: exports, imports, hygiene.
  {
    files: ALL_TS,
    rules: {
      'import/no-default-export': 'error',
      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/no-duplicates': 'error',
      'import/no-self-import': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@e07/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'no-restricted-imports': restrictedImports({}),
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-nested-ternary': 'error',
      'no-param-reassign': ['error', { props: true }],
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': [
        'error',
        { '{apps,packages,test}/**/': 'KEBAB_CASE' },
      ],
      'check-file/filename-blocklist': [
        'error',
        {
          '**/{util,utils,helper,helpers,misc,common,shared,stuff}.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
        },
      ],
    },
  },

  // 5. App runtime code: network, determinism of time, RTL-safe styles, i18n, SDK adapters.
  {
    files: RUNTIME,
    rules: {
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...TEST_GLOBALS],
      'no-restricted-properties': ['error', ...RESTRICTED_PROPERTIES],
      'no-restricted-imports': RUNTIME_IMPORTS,
      'no-restricted-syntax': runtimeSyntax(),
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, noAttributeStrings: false },
      ],
      'react-native/no-unused-styles': 'error',
      'react-native/no-inline-styles': 'error',
      'react-native/no-color-literals': 'error',
      'react-native/no-single-element-style-arrays': 'error',
      '@react-native/no-deep-imports': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/unsupported-syntax': 'error',
      'check-file/filename-blocklist': [
        'error',
        {
          '**/{util,utils,helper,helpers,misc,common,shared,stuff}.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
          'packages/*/src/**/index.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
          'apps/*/src/*/**/index.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
        },
      ],
    },
  },

  {
    files: ['packages/shell/src/**/*.{ts,tsx}'],
    ignores: ['packages/shell/src/config/**'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: RUNTIME_PATHS,
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },

  // 5-zones (docs/02 section 5.3). import/no-restricted-paths works on RESOLVED paths, so it
  // catches every spelling: an app never imports another app, and game code uses only the
  // Shell's game-facing folders. Target globs must match files, and basePath is the repo root.
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'apps/*/index.ts'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          basePath: ROOT,
          zones: [
            ...APP_IDS.map((id) => ({
              target: `./apps/${id}`,
              from: './apps',
              except: [`./${id}`],
              message: 'Apps never import each other; shared code moves to the Shell or game-kit.',
            })),
            {
              target: './apps/*/src/**/*',
              from: './packages/shell/src',
              except: GAME_FACING,
              message:
                'Game code uses only the Shell game-facing modules (game-host, art, audio, theme, asGameKey).',
            },
          ],
        },
      ],
    },
  },

  // 5-i18n. FormatJS for JSX text and user-facing props (FINAL C.28, docs/10): the Shell wraps
  // react-intl in t() and <T>, and only its i18n folder may import react-intl.
  {
    files: ['packages/*/src/**/*.tsx', 'apps/*/src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { formatjs },
    settings: { formatjs: { additionalFunctionNames: ['t'], additionalComponentNames: ['T'] } },
    rules: {
      'formatjs/no-literal-string-in-jsx': [
        'error',
        {
          props: {
            include: [
              [
                '*',
                '{accessibilityLabel,accessibilityHint,aria-label,aria-description,placeholder,title,alt,label}',
              ],
            ],
          },
        },
      ],
    },
  },
  {
    files: ['packages/shell/src/i18n/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, REACT_INTL_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },

  // 5a. Pure code (game-kit, rules, levels): no UI, no Shell, no platform.
  {
    files: PURE,
    rules: {
      'no-restricted-imports': restrictedImports({
        patterns: [NODE_BUILTINS, NO_TOOLING, PURE_IMPORTS],
      }),
    },
  },
  {
    files: ['packages/game-kit/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        patterns: [NODE_BUILTINS, PURE_IMPORTS, GAME_KIT_BOUNDARY],
      }),
    },
  },

  // 5b. Deterministic code (FINAL B.14): integer-safe arithmetic only.
  {
    files: DETERMINISTIC,
    rules: { 'no-restricted-syntax': [...runtimeSyntax(), ...DETERMINISM_SYNTAX] },
  },

  // 5c. File-level exemptions (the ONLY places these APIs are allowed).
  // Real-time sims mutate typed arrays inside shared values in place (FINAL B.13), and the
  // spatial hash fills caller-owned scratch buffers (FINAL B.17, docs/08).
  {
    files: ['apps/*/src/sim/**/*.ts', 'packages/game-kit/src/geom/spatial-hash.ts'],
    rules: { 'no-param-reassign': ['error', { props: false }] },
  },
  {
    files: ADAPTERS,
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, ...VENDOR_SDK_PATHS),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },
  // docs/12 section 3.1: the ADAPTERS block lifts every expo-iap ban, so the purchase adapter
  // gets the server-feature names back.
  {
    files: ['packages/shell/src/services/purchase/expo-iap-purchase-adapter.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: [...without(RUNTIME_PATHS, ...VENDOR_SDK_PATHS), EXPO_IAP_SERVER_APIS],
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },
  // FINAL H.1: the consent adapter alone imports expo-tracking-transparency (the ADAPTERS block above
  // keeps the ban for every other adapter).
  {
    files: ATT_ADAPTER,
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, ...VENDOR_SDK_PATHS),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
        allow: [ATT_IMPORT],
      }),
    },
  },
  {
    files: CLOCK_ADAPTERS,
    rules: {
      'no-restricted-properties': ['error', ...withoutProperty('Date', 'now')],
      'no-restricted-syntax': runtimeSyntax(['newDate']),
    },
  },
  {
    files: DIRECTION_MODULE,
    rules: {
      'no-restricted-properties': ['error', ...withoutProperty('I18nManager', 'isRTL')],
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, I18N_MANAGER_IMPORT, REACT_INTL_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY],
      }),
    },
  },
  // docs/05: raw Pressable only in ui/, raw Image only in the Icon component; ui/ stays presentational.
  {
    files: ['packages/shell/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, PRESSABLE_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY, UI_BOUNDARY],
      }),
    },
  },
  {
    files: ['packages/shell/src/ui/icons/icon.tsx'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, PRESSABLE_IMPORT, IMAGE_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY, UI_BOUNDARY],
      }),
    },
  },
  // docs/15: the cold-start log and the save benchmark (test builds only) read clocks.
  {
    files: PERF_CLOCK_FILES,
    rules: { 'no-restricted-properties': ['error', ...PERF_PROPERTIES] },
  },
  {
    files: APP_TEXT,
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: without(RUNTIME_PATHS, TEXT_IMPORT, PRESSABLE_IMPORT),
        patterns: [NODE_BUILTINS, SHELL_BOUNDARY, UI_BOUNDARY],
      }),
      'no-restricted-syntax': runtimeSyntax(['textAlignLiteral']),
    },
  },
  // Test-only code is loaded by require() behind an inline variant check, so Metro drops it
  // from store bundles (docs/14).
  {
    files: ['packages/shell/src/app/test-only.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['packages/shell/src/config/external-links.ts'],
    rules: { 'no-restricted-syntax': runtimeSyntax(['remoteUrl', 'remoteUrlTemplate']) },
  },

  // 6. Node code (tooling, config composer, config plugins): Node APIs and network allowed.
  {
    files: NODE_CODE,
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': ['error', ...NODE_CLOCK_PROPERTIES],
      'no-restricted-syntax': ['error', SYNTAX.enums, SYNTAX.importExtension, NODE_NEW_DATE],
      'no-restricted-imports': restrictedImports({}),
      'no-console': 'off',
    },
  },
  {
    files: ['packages/tooling/src/clock/system-clock.ts'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-syntax': ['error', SYNTAX.enums, SYNTAX.importExtension],
    },
  },
  // Expo reads the default export of app.config.ts and of a config plugin named by path.
  {
    files: ['apps/*/app.config.ts', 'packages/shell/plugins/**/*.ts'],
    rules: { 'import/no-default-export': 'off' },
  },

  // 7. Tests.
  {
    files: TESTS,
    extends: [jestPlugin.configs['flat/recommended'], jestPlugin.configs['flat/style']],
  },
  {
    files: TESTS,
    extends: [testingLibrary.configs['flat/react']],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': 'off',
      'max-nested-callbacks': ['error', 4],
      'sonarjs/no-duplicate-string': 'off',
      'react/jsx-no-literals': 'off',
      'react/no-multi-comp': 'off',
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-syntax': runtimeSyntax(['a11yLiteral']),
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'testing-library/no-await-sync-events': 'off',
      'testing-library/await-async-events': ['error', { eventModule: ['fireEvent', 'userEvent'] }],
      'jest/expect-expect': ['error', { assertFunctionNames: ['expect', 'fc.assert'] }],
      'jest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
      'jest/no-disabled-tests': 'error',
      'jest/no-focused-tests': 'error',
      'jest/require-top-level-describe': 'error',
      'jest/prefer-strict-equal': 'error',
      'jest/no-large-snapshots': ['error', { maxSize: 50, inlineMaxSize: 10 }],
      'jest/valid-title': ['error', { mustMatch: { it: '^(can|[a-z]+s)\\b' } }],
    },
  },
  { files: GOLDEN_TESTS, rules: { 'jest/no-large-snapshots': 'off' } },
  // Declaration merging (NodeJS.ProcessEnv, ReactNavigation.RootParamList) needs `interface`.
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
    },
  },
  {
    files: ['__mocks__/**/*.{ts,tsx}', 'jest.setup.ts'],
    rules: { 'import/no-default-export': 'off', 'no-restricted-imports': restrictedImports({}) },
  },
  // docs/07: root mocks mirror the libraries' PascalCase exports (AdsConsent, TestIds).
  {
    files: ['__mocks__/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/naming-convention': 'off' },
  },

  // 8. Plain JS config files: no type information.
  {
    files: JS_CONFIG,
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: { 'import/no-default-export': 'off', 'no-restricted-globals': 'off' },
  },

  // 9. Prettier last: turns off every formatting rule that conflicts with Prettier.
  prettierConfig,
]);
```

How to read and change it:

- **File groups** at the top map the canonical layout; a new top-level folder needs a new glob here, or its files silently get only the generic rules.
- **Rules other docs own are merged into the listing above** (2026-09-26, in this order); those docs explain them and point here, and hold no copy:
  1. docs/05 section 3.12: the UI-primitive import bans (`UI_PATHS`: `Pressable`, `Image`, `Dimensions`, `Animated`, `useMemo`/`useCallback`/`memo`, `react-native-svg`, `@shopify/flash-list`), the `storeWithoutSelector` selector, the presentational `ui/` boundary (`UI_BOUNDARY`), and the `PERF_CLOCK_FILES` exemption that docs/15 needs.
  2. docs/02 section 5.3: the app zones on resolved paths (block 5-zones: an app never imports another app, and game code imports only the `GAME_FACING` Shell modules).
  3. docs/12 section 3.1: `EXPO_IAP_SERVER_APIS` in the block after `ADAPTERS`, which keeps `kitApi`, `verifyPurchaseWithProvider` and the other banned `expo-iap` exports out of the purchase adapter.
  4. docs/07: `@typescript-eslint/naming-convention` off for `__mocks__/**` (the mocks mirror PascalCase library exports).
- **Shared option lists** (`BANNED_PACKAGE_PATHS`, `RUNTIME_PATHS`, `SYNTAX`, `RESTRICTED_PROPERTIES`) exist because a later block replaces a rule's options. An exemption block rebuilds the rule from these lists minus the one item it exempts (`withoutProperty('Date', 'now')`, `runtimeSyntax(['newDate'])`, `without(RUNTIME_PATHS, PRESSABLE_IMPORT)`). Every `no-restricted-imports` block of runtime code starts from `RUNTIME_PATHS`, so the i18n folder, the direction module and the adapters keep the UI bans too.
- **Exemptions are file-exact** on purpose: `Date.now`/`new Date()` only in `packages/shell/src/services/clock/*-adapter.ts` (app) and `packages/tooling/src/clock/system-clock.ts` (Node code, as docs/01 and docs/14 require; `new Date(value)` stays allowed in Node code); `I18nManager` only in `packages/shell/src/i18n/direction.ts`; `textAlign: 'left'|'right'` and the `Text` import only in `packages/shell/src/ui/app-text.tsx`; remote URLs only in `packages/shell/src/config/external-links.ts` (store, privacy-policy and mailto links handed to the OS); `require()` only in `packages/shell/src/app/test-only.ts` (docs/14 strips test-only code from store bundles with it); raw `Pressable` only in `packages/shell/src/ui/**` and raw `Image` only in `packages/shell/src/ui/icons/icon.tsx`; `Date.now` and `performance.now` also in docs/15's three `PERF_CLOCK_FILES`; vendor SDK imports only in `packages/shell/src/services/*/*-adapter.ts`, `*-save-store.ts` and `*-sql-driver.ts`. If the owning doc names such a file differently, change the glob here in the same commit, with a `Gate-Change:` trailer.
- **App zones** read the folder names under `apps/` each time ESLint starts, so a new app is covered without editing this file (an empty repo without `apps/` loads too). `GAME_FACING` lists the Shell modules game code may import: `game-host/`, `art/`, the audio port and `synth/`, `theme/theme-types.ts`, and `i18n/messages.ts` for docs/10's `asGameKey`.
- **The import resolver** is set to `typescript` with the workspace `tsconfig.json` files, so `import/no-cycle` follows `@e07/...` self-references (verified: a cycle through `@e07/shell/…` imports is reported).
- **Async handlers:** React Native's Strict TypeScript API declares `onPress?: (event) => unknown`, so `@typescript-eslint/no-misused-promises` accepts `onPress={async () => …}`. The `asyncHandler` selector closes that hole for inline `on*` props and for any `handleX` function.
- **Accessibility:** `pressableA11y` requires `role` (or `accessibilityRole`) on every `Pressable`; `a11yLiteral` forces labels through `t()`. The React Native a11y ESLint plugin supports only ESLint 8 and is not used (FINAL D.46).

### 4. Prettier

```json
{
  "$schema": "https://json.schemastore.org/prettierrc",
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

```gitignore
# .prettierignore: generated, vendored or binary-adjacent files Prettier must not touch.
package-lock.json
**/node_modules/
**/.expo/
apps/*/ios/
apps/*/android/
apps/*/build/
apps/*/dist/
coverage/
reports/
dist-audit/
tools/
.stryker-tmp/
**/__snapshots__/
**/__image_snapshots__/
apps/*/e2e/baselines/
# Hand-written engineering docs: Prettier would reflow their tables and rewrite their snippets.
docs/
```

Prettier runs as its own check (`npm run format:check`); `eslint-config-prettier` only turns off conflicting ESLint rules. There is no `eslint-plugin-prettier`. The PostToolUse hook formats every file the agent edits (docs/16), so formatting never needs thought. `docs/` is ignored: none of the engineering docs is Prettier-formatted (verified), so without the entry `format:check`, the Stop hook and `verify` would fail on day one, and `npm run format` would rewrite the docs' tables and code samples.

### 5. Limits

All limits are ESLint errors on every `.ts`/`.tsx` file (tests have their own column). There is no warning tier: with `--max-warnings 0` a warning would fail anyway, and two thresholds invite gaming.

| Metric | Limit | Tests | ESLint default | Rationale | Source |
|---|---|---|---|---|---|
| Lines per file (code only) | 250 | 400 | 300 | A 250-line file is read whole in one `Read` call and fits 2-3 agent viewer windows; defect studies show size predicts defects but give no universal optimum (Hatton: U-curve with a 200-400 sweet spot; El Emam: no threshold effect), so 250 is an engineering choice below the default | [max-lines](https://eslint.org/docs/latest/rules/max-lines); [Hatton 1997](https://doi.org/10.1109/52.582978); [El Emam 2001](https://doi.org/10.1109/32.935855); [El Emam 2002](https://doi.org/10.1109/TSE.2002.1000452); [SWE-agent](https://arxiv.org/abs/2405.15793); [Lost in the Middle](https://doi.org/10.1162/tacl_a_00638) |
| Lines per function (`.ts`) | 40 | off | 50 | Between Clean Code's ~20 and the ESLint default; within the kernel's "one or two screenfuls" | [max-lines-per-function](https://eslint.org/docs/latest/rules/max-lines-per-function); [Linux kernel style](https://www.kernel.org/doc/html/latest/process/coding-style.html) |
| Lines per component (`.tsx`) | 80 | off | 50 | JSX is verbose; bounded further by JSX depth 5 and one component per file | same |
| Cyclomatic complexity | 10, `variant: 'modified'` | 10 | 20 | McCabe's limit, kept by NIST SP 500-235. ESLint's classic count adds +1 per `case`, `?.`, `??` and default parameter, so an exhaustive 11-case switch over a union fails; `modified` counts a whole `switch` once (verified) | [complexity](https://eslint.org/docs/latest/rules/complexity); [McCabe 1976](https://doi.org/10.1109/TSE.1976.233837); [NIST SP 500-235](https://www.nist.gov/publications/structured-testing-software-testing-methodology-using-cyclomatic-complexity-metric) |
| Cognitive complexity | 15 | 15 | 15 (Sonar) | Bounds nesting and branching that `modified` complexity no longer counts | [SonarJS S3776](https://github.com/SonarSource/SonarJS) |
| Nesting depth | 3 | 3 | 4 | "If you need more than 3 levels of indentation, you're screwed anyway" | [max-depth](https://eslint.org/docs/latest/rules/max-depth); Linux kernel style |
| Parameters | 3 | 3 | 3 | Beyond three, pass one options object with named fields | [max-params](https://eslint.org/docs/latest/rules/max-params) |
| Nested callbacks | 3 | 4 | 10 | Tests need describe → it → property → callback | [max-nested-callbacks](https://eslint.org/docs/latest/rules/max-nested-callbacks) |
| JSX depth | 5 (root = 0) | 5 | none | A sixth level fails (verified semantics); extract a component | [react/jsx-max-depth](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-max-depth.md) |
| Components per file | 1 | any | none | One exported unit per file, easy to locate | [react/no-multi-comp](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-multi-comp.md) |
| Classes per file | 1 | 1 | none | Same | [max-classes-per-file](https://eslint.org/docs/latest/rules/max-classes-per-file) |
| Duplicate string literal | 3 occurrences | off | none | Name a repeated literal once | [SonarJS S1192](https://github.com/SonarSource/SonarJS) |
| Line width | 100 (Prettier) | 100 | n/a | Airbnb's `max-len` | [Airbnb style](https://github.com/airbnb/javascript/blob/master/packages/eslint-config-airbnb-base/rules/style.js) |

When a limit trips:

- A long function: extract the steps into named pure functions in the same file (each gets a TSDoc line if exported) or, if they form their own responsibility, a sibling module with its own test.
- High complexity: replace condition chains with a lookup table (`as const` object keyed by a union) or an exhaustive `switch` over a union.
- Deep JSX: extract a child component into its own file with a `<Component>Props` type.
- A long file: split by responsibility (rules vs. scoring vs. generation), never into `part-1.ts`/`part-2.ts`.
- Too many parameters: one `readonly` options object type named `<Function>Options`.

### 6. Policies

#### 6.1 Comments and TSDoc

- Line 1 of every `.ts`/`.tsx` file is `// <repo-relative path>` (docs/03 rule 18).
- Exported API in `packages/game-kit`, ports, stores, reducers and hooks: one `/** … */` sentence that states the contract, the unit or the reason (`/** Returns the next uint32 and the advanced state; never mutates its input. */`). Add `@param`/`@returns` only when a name cannot carry the meaning. TSDoc syntax: [tsdoc.org](https://tsdoc.org/).
- Inside functions, comment *why*, never *what*; cite the spec (`spec 8.8`) or decision (`FINAL B.14`) when a line exists because of one.
- English, full sentences, no ASCII art, no author names or dates, no `TODO`/`FIXME`/`HACK` (`no-warning-comments`), no commented-out code (`sonarjs/no-commented-code`), no `eslint-disable` (inert and reported).

#### 6.2 Error handling

Decide by asking "can this happen in a correct program?"

| Situation | Mechanism | Example |
|---|---|---|
| Expected failure with reasons | return `Result<TValue, TError>`; `TError` is a `kind` union | illegal move, corrupt or newer save, store unavailable, purchase cancelled |
| Expected absence, no reason needed | return `T \| null` | `intentToMove` finds no move; a hit test misses |
| External SDK failure | the adapter catches, maps to a `Result` or a typed state, and records unexpected ones through `ErrorLogPort` | ad load `no-fill` is expected (silent); an unknown error code is recorded |
| Broken invariant, contract misuse, impossible state | `throw new Error(message, { cause })` | a hook used outside its provider; a config value outside its union |
| Render error | the Shell error boundary records it and shows the recovery screen (spec 8.14) | never a crash loop |
| Error on the UI thread (frame callback) | `try/catch` in the callback → pause the game → `scheduleOnRN` to record it (FINAL B.15) | |
| Anything uncaught | the Shell's global handler and unhandled-rejection tracker record it | last resort, not a strategy |

The shared result type lives in game-kit so rules, Shell and apps use one shape:

```ts
// packages/game-kit/src/contract/result.ts

/** Outcome of an operation that can fail in an expected, recoverable way. */
export type Result<TValue, TError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

/** Wraps a success value. */
export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

/** Wraps an expected failure. `error` is a `kind`-discriminated union, never a string. */
export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}
```

A game rule returns it instead of throwing:

```ts
// apps/line-siege/src/rules/apply-move.ts
import { err, ok, type Result } from '@e07/game-kit/contract/result.ts';

export type GameState = { readonly columns: readonly number[]; readonly score: number };

export type Move = { readonly kind: 'place-block'; readonly column: number };

export type GameEvent =
  | { readonly kind: 'block-placed'; readonly column: number }
  | { readonly kind: 'column-cleared'; readonly column: number };

export type MoveError = { readonly kind: 'column-out-of-range'; readonly column: number };

export type ApplyResult = { readonly state: GameState; readonly events: readonly GameEvent[] };

const COLUMN_HEIGHT = 8;
const CLEAR_BONUS = 10;

/** Applies one move; an illegal move is an expected failure, returned as a value. */
export function applyMove(state: GameState, move: Move): Result<ApplyResult, MoveError> {
  const height = state.columns[move.column];
  if (height === undefined) {
    return err({ kind: 'column-out-of-range', column: move.column });
  }
  const isFull = height + 1 === COLUMN_HEIGHT;
  const nextHeight = isFull ? 0 : height + 1;
  const columns = state.columns.map((value, index) => (index === move.column ? nextHeight : value));
  const events: GameEvent[] = [{ kind: 'block-placed', column: move.column }];
  if (isFull) {
    events.push({ kind: 'column-cleared', column: move.column });
  }
  const score = state.score + (isFull ? CLEAR_BONUS : 1);
  return ok({ state: { columns, score }, events });
}
```

The error log port (spec 8.14). `record` never throws and never rejects, so it is safe inside any `catch`:

```ts
// packages/shell/src/services/error-log/error-log-port.ts

/** Where an error was caught. Values are kebab-case and stable (they appear in exported logs). */
export type ErrorSource =
  | 'render'
  | 'frame-callback'
  | 'save'
  | 'ads'
  | 'purchase'
  | 'audio'
  | 'haptics'
  | 'unhandled-rejection'
  | 'global-handler'
  | 'boot'
  | 'i18n'
  | 'network';

export type ErrorLogEntry = {
  readonly atMs: number;
  readonly source: ErrorSource;
  readonly message: string;
};

/** Spec 8.14: the local error log. `record` never throws and never rejects. */
export type ErrorLogPort = {
  readonly record: (source: ErrorSource, error: unknown) => void;
  readonly entries: () => readonly ErrorLogEntry[];
};
```

Rules for `catch`:

- `catch (error)` is `unknown`; narrow with `error instanceof Error` before reading `.message`.
- Rethrow with context: `throw new Error('save migration v3→v4 failed', { cause: error })`.
- Only throw `Error` objects (`@typescript-eslint/only-throw-error`); reject promises with `Error` objects (`prefer-promise-reject-errors`).
- A best-effort cosmetic effect may ignore its own failure inside its adapter, as FINAL C.21 does for haptics (`.catch(() => undefined)`); prefer recording the first failure per session through `ErrorLogPort`. Nowhere else.
- User-facing error text is a translated message chosen from the error `kind` (spec S14 dialogs), never `error.message`.

#### 6.3 Async code

- **No floating promises**; `void` does not count as handling (`ignoreVoid: false`).
- **Synchronous handlers.** Fire-and-forget work ends in `.catch(reportError)`, where `reportError` records to the error log:

```ts
// packages/shell/src/services/error-log/use-report-error.ts
import { useServices } from '@e07/shell/app/services-context.tsx';

import type { ErrorSource } from './error-log-port.ts';

/** Returns a rejection handler for fire-and-forget work: `task().catch(reportError)`. */
export function useReportError(source: ErrorSource): (error: unknown) => void {
  const { errorLog } = useServices();
  return (error: unknown): void => {
    errorLog.record(source, error);
  };
}
```

```tsx
// packages/shell/src/screens/premium/buy-button.tsx
import { useReportError } from '@e07/shell/services/error-log/use-report-error.ts';
import { PrimaryButton } from '@e07/shell/ui/primary-button.tsx';

export type BuyButtonProps = {
  readonly label: string;
  readonly isBusy: boolean;
  readonly onBuy: () => Promise<void>;
};

/** Spec S12 BUY button. The handler stays synchronous; failures reach the error log. */
export function BuyButton({ label, isBusy, onBuy }: BuyButtonProps): React.JSX.Element {
  const reportError = useReportError('purchase');
  const handlePress = (): void => {
    onBuy().catch(reportError);
  };
  return (
    <PrimaryButton
      label={label}
      isBusy={isBusy}
      testID="premium.buy-button"
      onPress={handlePress}
    />
  );
}
```

- **Timeouts belong to adapters.** Play never waits for the network (spec 8.8): every await on an SDK that can hang is wrapped, and a timeout is an expected failure, not an exception:

```ts
// packages/shell/src/services/async/with-timeout.ts
import { err, ok, type Result } from '@e07/game-kit/contract/result.ts';

export type TimeoutError = { readonly kind: 'timed-out'; readonly afterMs: number };

/**
 * Resolves with the task's value, or with a `timed-out` error after `afterMs`.
 * Never rejects for a timeout; a rejection of `task` itself still propagates.
 */
export async function withTimeout<TValue>(
  task: Promise<TValue>,
  afterMs: number,
): Promise<Result<TValue, TimeoutError>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Result<TValue, TimeoutError>>((resolve) => {
    timer = setTimeout(() => {
      resolve(err({ kind: 'timed-out', afterMs }));
    }, afterMs);
  });
  try {
    return await Promise.race([task.then((value) => ok(value)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
```

- No `async` Promise executors (`no-async-promise-executor`); no `new Promise` around code that is already async.
- Run independent awaits together (`Promise.all`); await sequentially only when order matters (migrations v1→v2→v3).
- No promises, `await` or `setTimeout` in worklets; the UI thread talks to JS through `scheduleOnRN` (FINAL B.15).
- `setTimeout` always gets an explicit delay (`setTimeoutNoDelay`), and every timer is cleared (in `finally` or an effect cleanup).
- Time comes from `ClockPort` (or the frame timestamp on the UI thread), never from `Date.now()`, `new Date()` or `performance.now()`.

#### 6.4 Immutability and purity

- Types: `readonly` on every property, `readonly T[]` for arrays, `Readonly<Record<…>>` for maps. Constant tables: `as const` (with `satisfies` when a type must be checked).
- Updates: spread into a new object (`{ ...state, theme: action.theme }`), `map`/`filter` into new arrays. Never mutate a parameter (`no-param-reassign` with `props: true`); `const` unless reassigned (`prefer-const`); class fields `readonly` where possible (`@typescript-eslint/prefer-readonly`).
- Sort without mutating: `[...list].sort(compare)`.
- Engine state is JSON-serialisable: no `Map`, `Set`, class instances, functions or `undefined` values in a save, run log or replay.
- Exceptions (FINAL B.13, B.17): the real-time loop in `apps/*/src/sim/**` mutates typed arrays inside Reanimated shared values in place to avoid per-frame allocation, and game-kit's `geom/spatial-hash.ts` fills caller-owned scratch buffers; the ESLint config relaxes `no-param-reassign` only for those files.
- Purity (rules, levels, game-kit): output depends only on inputs; randomness comes from the seeded RNG state inside the game state; time arrives as a parameter.

#### 6.5 Dependency injection

- The composition root (`createShellApp` in `packages/shell/src/app/create-shell-app.tsx`, docs/02 rule 7 and docs/06 section 7.2) creates each adapter once and passes the set to `ServicesProvider`. React Context is used for dependency injection only (services, theme, game module; FINAL A.5), never for app state.
- Components read ports with `useServices()`; stores and services receive ports as factory arguments (`createPremiumService({ purchase, saveStore, clock })`); pure functions receive plain values (`nowMs: number`, `seed: number`).
- Tests render with fakes through docs/07's `renderWithShell`, which passes only the ports a test gives it (any other port throws on first use), so no test needs `jest.mock` for our own modules. Root `__mocks__/` exist only for vendor SDKs that crash when imported in Jest.
- The `Services` type, `ServicesProvider` and `useServices()` live in `packages/shell/src/app/services-context.tsx`; the complete file, with all nine ports, is in docs/02 section 6.3.

- No service locators, no mutable module-level registries, no importing an adapter from a screen or store.

#### 6.6 Imports

| Import | Form | Example |
|---|---|---|
| Same folder | `./file.ext` | `import { ok } from './result.ts';` |
| Sub-folder of the current folder | `./folder/file.ext` | `import { synthesizeRecipe } from './synth/synthesize-recipe.ts';` (from `services/audio/`) |
| Other folder, same package | package self-reference | `import { AppText } from '@e07/shell/ui/app-text.tsx';` |
| Other workspace | package name | `import { createRng } from '@e07/game-kit/rng/sfc32.ts';` |
| npm package | bare name, public entry only | `import { create } from 'zustand';` |
| Types | separate `import type` | `import type { ExpoConfig } from 'expo/config';` |
| JSON data | default import of the file | `import en from './en.json';` |

- The workspace packages expose `"exports": { "./*": "./src/*" }` (the shell also `"./plugins/*": "./plugins/*"`), so `@e07/shell/ui/app-text.tsx` means `packages/shell/src/ui/app-text.tsx`.
- Order is enforced and auto-fixed (`import/order`): built-ins, external packages, `@e07/*`, relative, then type imports in their own group; blank lines between groups. The PostToolUse hook runs `eslint --fix`, so the agent never orders imports by hand.
- No deep imports into `react-native/Libraries/*` (`@react-native/no-deep-imports`; also a type error under the Strict TypeScript API).
- No barrel files and no re-exports for convenience; import the file that defines the symbol.

### 7. Forbidden patterns

| Pattern | Reason | Enforced by |
|---|---|---|
| `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` in app code | spec N3 | `no-restricted-globals` |
| `http(s)://`, `ws(s)://`, `ftp://` literals in app code (except `external-links.ts`) | N3: remote images, fonts and downloads make requests without `fetch` | `no-restricted-syntax` `remoteUrl*` |
| `axios`, `@react-native-community/netinfo`, `react-native-webview`, `expo-web-browser`, `expo-updates` | network surfaces (NetInfo's probe calls Google) | `no-restricted-imports` |
| `expo-router` | the Shell owns navigation (FINAL A.4) | `no-restricted-imports` |
| `expo-audio`, `expo-file-system`, `@react-native-async-storage/async-storage`, `react-native-iap`, `react-native-purchases`, `react-native-restart` | replaced by a decided port or banned by the spec | `no-restricted-imports` |
| Vendor SDK import outside its adapter | one adapter per port (FINAL C) | `no-restricted-imports` + `ADAPTERS` block |
| `expo-tracking-transparency` anywhere but `packages/shell/src/services/consent/admob-consent-adapter.ts` | Apple's ATT prompt is asked in one place (FINAL H.1, H.20) | `no-restricted-imports` (`ATT_IMPORT` in `BANNED_PACKAGE_PATHS`) + the file-exact `ATT_ADAPTER` block with `allow: [ATT_IMPORT]` |
| `Math.random`, `Date.now`, `performance.now`, `new Date()` | determinism, testable time (spec S15 set-date) | `no-restricted-properties`, `no-restricted-syntax` |
| `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `.toLocaleString()`, `.toLocaleDateString()`, `.toLocaleTimeString()` | Hermes applies the Persian calendar and ignores the digits setting (FINAL C.29); numbers go through `t()` or docs/10's `createNumberFormatter` | `no-restricted-syntax` `intlDate`, `toLocaleCall` |
| `Math.sin/cos/tan/atan2/exp/log/pow`, `**` in deterministic folders | libm differences across devices (FINAL B.14) | `no-restricted-syntax` `DETERMINISM_SYNTAX` |
| `I18nManager` outside `direction.ts` | one source of direction (FINAL C.31) | `no-restricted-imports`, `no-restricted-properties` |
| `left`, `right`, `marginLeft`, `paddingRight`, `borderTopLeftRadius`… in styles | spec N11 | `no-restricted-syntax` `physicalStyleKeys` |
| `textAlign: 'left' \| 'right'` outside `AppText`; `flexDirection: 'row-reverse'` | N11: RN already mirrors | `no-restricted-syntax` |
| `Text` from `react-native` outside `AppText` | alignment and writing direction live in one component (FINAL A.7) | `no-restricted-imports` |
| JSX string literals; literal `accessibilityLabel`, `aria-label`, `accessibilityHint`, `placeholder`, `title`, `alt` | spec N12 | `react/jsx-no-literals`, `a11yLiteral` |
| Inline styles, color literals, unused styles, single-element style arrays | theme tokens only (FINAL A.7) | `react-native/*` |
| `Alert` from `react-native` | Shell dialogs (spec S14) | `no-restricted-imports` |
| `react-intl` outside `packages/shell/src/i18n/` | the Shell's `t()`/`<T>` wrapper owns formatting, bidi isolation and digits (FINAL C.28, C.29) | `no-restricted-imports` |
| `SafeAreaView` from `react-native` | deprecated; use react-native-safe-area-context | `no-restricted-imports` |
| `enum`, `namespace`, constructor parameter properties | not erasable; use unions | `erasableSyntaxOnly`, `TSEnumDeclaration` |
| `interface` (outside `*.d.ts`) | one way to declare types | `consistent-type-definitions` |
| `export default` (except `app.config.ts`, config plugins, `__mocks__`) | names must be greppable | `import/no-default-export` |
| `Date.now()`, `new Date()` in tooling or config outside `clock/system-clock.ts` | one testable clock (docs/01, docs/14) | `no-restricted-properties`, `no-restricted-syntax` |
| `../` imports; extensionless internal imports | predictable paths; Node type stripping | `PARENT_IMPORT`, `importExtension` |
| Node built-ins (`node:*`, `fs`, `path`…) in app code | they do not exist in the app runtime | `NODE_BUILTINS` |
| Importing an app from the Shell, the Shell from game-kit or rules, tooling from anything | dependency direction (spec N5) | `SHELL_BOUNDARY`, `GAME_KIT_BOUNDARY`, `PURE_IMPORTS`, `NO_TOOLING` |
| Import cycles | untestable coupling | `import/no-cycle` |
| `async` event handlers | unhandled rejections (Strict API hides them) | `asyncHandler` |
| Floating promises, `void promise` | silent failures | `no-floating-promises` |
| Empty `catch` | swallowed errors | `no-empty` |
| `any`, unsafe member access, non-null `!` in app code | type holes | typescript-eslint strict |
| Truthiness checks on strings and numbers (`if (count)`) | `0` and `''` bugs | `strict-boolean-expressions` |
| Non-exhaustive `switch` over a union | a new union member is silently ignored | `switch-exhaustiveness-check` |
| `console.log` in app code | no logging service; use the error log or the debug menu | `no-console` |
| `eslint-disable`, `@ts-ignore`, `@ts-nocheck` | silencing gates | `noInlineConfig`, `ban-ts-comment` |
| `TODO`/`FIXME`/`HACK` comments, commented-out code | never revisited | `no-warning-comments`, `sonarjs/no-commented-code` |
| `utils.ts`, `helpers.ts`, `common.ts`, barrel `index.ts` | grab-bag modules, cycles | `check-file/filename-blocklist` |
| `Pressable` without `role` | spec 8.11 | `pressableA11y` |
| Test globals (`jest`, `describe`, `expect`…) in app code | tests stay in test files | `no-restricted-globals` |
| `useMemo`/`useCallback`/`React.memo` without a measured need | React Compiler memoizes (FINAL A.2) | review, `react-hooks` compiler rules |
| Reanimated `.value` | use `.get()`/`.set()` with the React Compiler (FINAL A.2) | review |

## Checklist

- [ ] `npm run check:fast` passes (Prettier, ESLint with `--max-warnings 0`, all `tsc` projects, related tests).
- [ ] No new `eslint-disable`, `@ts-ignore`, `@ts-nocheck`; any `@ts-expect-error` has a real description and a third-party cause.
- [ ] No file over 250 code lines (400 for tests), no function over 40 lines (80 for a component), and splits were made by responsibility.
- [ ] Every new exported API in game-kit, ports, stores and hooks has a one-sentence TSDoc summary; no TODOs; no commented-out code.
- [ ] Every expected failure is a `Result` (or `null`) with a `kind` union; every `catch` maps, records or rethrows with `cause`.
- [ ] No floating promise, no `async` handler; fire-and-forget ends in `.catch(reportError)`.
- [ ] New app-code imports use `./x.ts` or `@e07/<package>/…ext`; no `../`; no vendor SDK outside its adapter; no Node built-ins outside Node-world folders.
- [ ] New pure code (rules, levels, game-kit) imports nothing from React, React Native, Expo, Skia or the Shell and uses only integer-safe math.
- [ ] Any config exception is a named, commented `files` block in `eslint.config.mjs`, committed with `Gate-Change:`; `quality-gates.json` still matches (`node packages/tooling/src/quality/check-quality-gates.ts`).
- [ ] A new Node-world file sits under `packages/tooling`, `packages/shell/src/config` or `packages/shell/plugins`, and no app file imports it.

## Sources

- FINAL-DECISIONS A.3, A.5, A.7, A.8, B.13-B.15, C.21-C.31, D.34-D.37 (binding decisions this doc implements).
- TypeScript 6.0 announcement (types default, deprecations): https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- TypeScript 5.7, ancestor tsconfig search: https://devblogs.microsoft.com/typescript/announcing-typescript-5-7/
- TSConfig reference: https://www.typescriptlang.org/tsconfig/
- React Native Strict TypeScript API: https://reactnative.dev/docs/strict-typescript-api
- Node.js TypeScript support: https://nodejs.org/api/typescript.html
- Expo: using ESLint and Prettier: https://docs.expo.dev/guides/using-eslint/
- Expo: TypeScript: https://docs.expo.dev/guides/typescript/
- ESLint flat config and linter options: https://eslint.org/docs/latest/use/configure/configuration-files
- ESLint selectors: https://eslint.org/docs/latest/extend/selectors
- ESLint version support (v9 EOL): https://eslint.org/version-support/
- typescript-eslint shared configs and dependency versions: https://typescript-eslint.io/users/configs and https://typescript-eslint.io/users/dependency-versions
- typescript-eslint rules: https://typescript-eslint.io/rules/no-floating-promises, https://typescript-eslint.io/rules/no-misused-promises, https://typescript-eslint.io/rules/naming-convention, https://typescript-eslint.io/rules/strict-boolean-expressions
- eslint-plugin-import `no-cycle`, `order`: https://github.com/import-js/eslint-plugin-import/tree/main/docs/rules
- eslint-plugin-react-hooks (React Compiler rules): https://react.dev/reference/eslint-plugin-react-hooks
- eslint-plugin-react-native: https://github.com/Intellicode/eslint-plugin-react-native
- eslint-plugin-check-file: https://github.com/dukeluo/eslint-plugin-check-file
- SonarJS rules: https://github.com/SonarSource/SonarJS
- Prettier options and rationale: https://prettier.io/docs/options and https://prettier.io/docs/rationale
- TSDoc: https://tsdoc.org/
- Google TypeScript style guide: https://google.github.io/styleguide/tsguide.html
- Limits evidence: McCabe 1976 https://doi.org/10.1109/TSE.1976.233837; NIST SP 500-235 https://www.nist.gov/publications/structured-testing-software-testing-methodology-using-cyclomatic-complexity-metric; Linux kernel coding style https://www.kernel.org/doc/html/latest/process/coding-style.html; Hatton 1997 https://doi.org/10.1109/52.582978; El Emam et al. 2001 https://doi.org/10.1109/32.935855 and 2002 https://doi.org/10.1109/TSE.2002.1000452; SWE-agent https://arxiv.org/abs/2405.15793; Lost in the Middle https://doi.org/10.1162/tacl_a_00638

## Verified

On 2026-09-26, in a throwaway npm-workspaces monorepo with the canonical layout (`scratchpad/rn/writer-03-04-16/repo`: `packages/game-kit`, `packages/shell` with `src/config` and `plugins`, `packages/tooling`, `apps/line-siege`), Node 26.4.0, npm 11.17.0, TypeScript 6.0.3, ESLint 9.39.5, typescript-eslint 8.70.1, eslint-config-expo 57.0.2, React Native 0.86.3, React 19.2.3, Jest 29.7 + jest-expo 57.0.5, Prettier 3.9.9:

- All six tsconfig files type-check; `tsc -p` per project with `incremental` takes about 0.5 s warm; the full `npm run typecheck` about 2 s on the sample code. A type-only import from an app file into `with-shell.ts` fails (`process`, `node:fs` unknown), which is why `GameConfig` lives in a neutral file. Adding `expo-env.d.ts` to an app program breaks `TextStyle` (TS2559).
- The complete `eslint.config.mjs` above loads, lints the whole sample repo clean in about 4-6 s, and loads against a copy of the `mono` probe (it flags the probe's `App.tsx`, default export, inline style, `Text` import and inert `eslint-disable` comments as expected). Type-aware rules work in Node-world files through the root `tsconfig.json` (ancestor search).
- Two deliberately bad files (a component and a rules module) triggered 63 errors covering every custom rule: parent import, Node built-in, vendor SDK, `Alert`, `Text`, `I18nManager`, enum, default export, missing return type, `Math.random`, `Date.now`, `performance.now`, `new Date()`, `fetch`, remote URL, floating promise with `void`, inline style, `marginLeft`, `paddingRight`, `textAlign: 'left'`, color literal, unused style, JSX literal, literal `accessibilityLabel`, bad testID, `Pressable` without role, non-kebab `kind` values, boolean names. In a rules folder: React Native and Shell imports, `Math.sin`, `Math.cos`, `**` were rejected; `left`/`right` data keys, `Math.floor` and `Math.PI` were accepted. Game-kit importing the Shell or an app was rejected.
- `import/no-cycle` reported a cycle through `@e07/shell/…` self-references; `no-async-promise-executor`, `no-warning-comments` (TODO) and `sonarjs/no-commented-code` fired; `asyncHandler` flagged an inline `async` `onPress`, an `async` `handleBuy` arrow and an `async function handleSave`, while `no-misused-promises` did not (Strict API `onPress` returns `unknown`).
- `formatjs/no-literal-string-in-jsx` (with `t`/`T` registered) reported a literal `accessibilityLabel`, and the `react-intl` ban reported a direct `FormattedMessage` import outside the i18n folder; test files are excluded from the FormatJS rule.
- The Node-world chain `apps/line-siege/app.config.ts` → `@e07/shell/config/with-shell.ts` → `@e07/shell/plugins/with-privacy-manifest-check.ts` → `expo/config-plugins.js` loads with `APP_VARIANT=test npx expo config --type public` (Node 26.4 type stripping, `"type": "module"` packages, explicit extensions) and prints `updates.enabled: false`.
- The code samples in this doc (`result.ts`, `apply-move.ts`, `error-log-port.ts`, `use-report-error.ts`, `buy-button.tsx`, `with-timeout.ts` with 2 passing tests, `app-env.d.ts`) pass Prettier, ESLint and `tsc` unchanged. (The `services-context.tsx` sample that was here is now a pointer to docs/02 section 6.3, which owns the file.) The integration pass on 2026-09-26 added `'boot'`, `'i18n'` and `'network'` to `ErrorSource` (a type-only union change).
- Reviewer re-check (same day, fresh copy in `scratchpad/rn/verify-conventions/repo`): the config above, with the wall-clock, `toLocaleCall` and config-plugin changes, lints the sample repo clean; `Date.now()` and `new Date()` in a tooling file, and `best.toLocaleString()` in the Shell, are rejected; `new Date(0)` in tooling, `new Date()` in `clock/system-clock.ts` and a default-exported config plugin pass. `buy-button.tsx` now renders docs/05's `PrimaryButton` (props copied from docs/05) and lints clean both with this file and with docs/05 section 3.12 applied, which rejects the earlier version's `Pressable` import in a screen. The writer's version of the config also linted the architecture workspace (about 100 Shell files) with 4 findings; one was a default-exported config plugin named by path, which led to the plugin exemption above. Every version in section 1 matches `npm view` on 2026-09-26 (eslint `maintenance` = 9.39.5, typescript-eslint 8.70.1 peers `typescript >=4.8.4 <6.1.0`, eslint-plugin-react-native 5.0.0 published 2024-12-30), and eslint.org lists ESLint 9 as EOL since 2026-08-06.
- Merge check (2026-09-26, `scratchpad/fix-final/repo`, a copy of `rn/verify-testing/repo`): the listing above is byte-identical to the file that ran. It passes Prettier, `--print-config` resolves as intended for an adapter, a `__mocks__` file, a `ui/` component, a rules file, `test-only.ts` and a tooling script, and `eslint . --max-warnings 0` is clean (174 files; before the merge, 11 `naming-convention` errors in the GMA mock). Probes still fail: `fetch`, a remote URL, `marginLeft` in `StyleSheet.create`, enums (app, rules and tooling), `../` imports, `Math.random`/`Math.sin` in rules, `Date.now` in tooling, `Pressable`/`useMemo`/a bare `useSettingsStore()` in a screen, `Image` and a store import in `ui/`, `useMemo` in the i18n folder, `Image` in an adapter, `kitApi` in the purchase adapter, and app→app and app→store imports; `asGameKey`, port types in `ui/` and game-facing types in an app pass. The same file linted docs/02 and docs/06's workspace copy (176 files) clean, loaded without an `apps/` folder, and docs/16's four guardrail probes still match `quality-gates.json`.
- Re-verify: `npm view <package> version` for every row of section 1, `npx expo install --check` in each app, then `npm run verify` (which includes the guardrail that compares the resolved configs with `quality-gates.json`).

## Open issues

1. **Node-API test helpers.** Package tsconfigs carry only `jest` types, so a test that needs Node APIs (FINAL A.6's SaveStore tests against `node:sqlite`) cannot live inside `packages/shell/src`. Put such tests and their Node driver under the root `test/integration/<area>/` (root program has `jest` + `node` types, and the driver sits next to the test so no `../` import is needed). docs/07's `jest.config.js` keeps `<rootDir>/test/**` in its test roots (resolved).
2. **Exemption file names.** The ESLint exemptions name `packages/shell/src/services/clock/*-adapter.ts`, `packages/shell/src/i18n/direction.ts`, `packages/shell/src/ui/app-text.tsx` and `packages/shell/src/config/external-links.ts`. If an owning doc names such a file differently, change the globs (with `Gate-Change:`), not the rules. Checked in the integration pass on 2026-09-26: every exempted file name matches its owner (docs/06 `system-clock-adapter.ts`, docs/10 `direction.ts`, docs/05 `app-text.tsx`, docs/02 `external-links.ts`, docs/14 `src/app/test-only.ts`), and docs/12's `create-premium-iap.ts` takes the time from `clock/system-clock.ts`.
3. **Resolved: one copy of the config.** docs/05 section 3.12, docs/02 section 5.3 (app zones), docs/12 section 3.1 (the `expo-iap` adapter block) and docs/07's `__mocks__` naming block are merged into the listing in section 3; those docs now point here. The merge also settled docs/05 open issue 6 (the i18n, direction and adapter blocks start from `RUNTIME_PATHS`) and added `i18n/messages.ts` to `GAME_FACING` so a game's `asGameKey` table (docs/10) is not rejected.
4. **`packages/shell` exports.** The config composer imports local config plugins through `@e07/shell/plugins/<file>.ts`, which needs `"./plugins/*": "./plugins/*"` in `packages/shell/package.json` `exports` (verified with `tsc`). The architecture workspace seen on 2026-09-26 has it; keep it when scaffolding.
5. **Metro and explicit extensions.** `tsc`, Jest and Node resolve `@e07/shell/ui/app-text.tsx` and `./x.ts`. This doc's own session could not bundle the probe copy (symlinked `node_modules`), but the architecture workspace's Metro export of `apps/line-siege/index.ts`, whose imports are all extension-bearing `@e07/shell/…` specifiers, finished (919 modules) and produced a Release simulator app on 2026-09-26. Keep one such import in docs/02's Metro check.
6. **Lint scale.** Type-aware lint builds one TypeScript program per workspace. With ~26 apps a full `npm run lint` will grow roughly linearly (about 3.6 s for the sample repo today). If it passes about 2 minutes, lint per workspace in parallel rather than weakening rules.
