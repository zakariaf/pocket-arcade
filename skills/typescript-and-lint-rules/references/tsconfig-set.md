# The tsconfig set: two worlds, six files

Why the monorepo has six `tsconfig.json` files, what each compiler option buys, and the rules for Node-side TypeScript. Read this before creating or changing any tsconfig, when `tsc` reports a missing global (`process`, `node:fs`), or when a file seems to be type-checked by the wrong program.

## Contents

- Two worlds
- The six files
- How tsc, ESLint and Expo find a file's program
- What each compiler option buys
- `process.env` in app code: app-env.d.ts
- Route types in app programs: react-navigation.d.ts
- Node-world rules (tooling, config composer, config plugins)
- Verified facts

## Two worlds

Code lives in one of two worlds and never mixes them.

| World | Where | Types | Runs in |
|---|---|---|---|
| App | `packages/game-kit/src`, `packages/shell/src` (except `src/config`), `apps/<game>/{index.ts,game.config.ts,src}` | `jest` (no Node types) | the app bundle (Hermes), Jest |
| Node | `packages/tooling/src`, `packages/shell/src/config`, `packages/shell/plugins`, `apps/<game>/app.config.ts`, root `test/`, `jest.setup.ts`, `__mocks__/` | `node` (+ `jest`) | Node 26 with type stripping, Jest |

- App code never imports a Node-world file, not even with `import type`: a type-only import still pulls the file into the app program, where `process` and `node:fs` do not type-check (verified).
- Node code is never bundled into an app. `node:*` imports are banned in app code by ESLint (`NODE_BUILTINS`).
- A few **neutral files** are read by both worlds, for example `packages/shell/src/config/game-config.ts` (only the `GameConfig` type) and `app-variant.ts` (a pure parser). They import nothing from Node or React Native. A game's `game.config.ts` imports its type from `@e07/shell/config/game-config.ts`, never from `with-shell.ts`.

## The six files

| File | Template | World | `types` | Covers |
|---|---|---|---|---|
| `tsconfig.base.json` | `templates/tsconfig.base.json` | shared | `[]` | compiler options only |
| `tsconfig.json` (root) | `templates/tsconfig.root.json` | tests + Node-side config | `jest`, `node` | `jest.setup.ts`, `__mocks__/**`, `test/**`, `apps/*/app.config.ts`, `packages/shell/src/config/**`, `packages/shell/plugins/**` |
| `packages/game-kit/tsconfig.json` | `templates/tsconfig.game-kit.json` | app (pure) | `jest`, `lib: ["ESNext"]` | `src/**` |
| `packages/shell/tsconfig.json` | `templates/tsconfig.shell.json` | app | `jest` | `src/**` except `src/config/**` |
| `apps/<game>/tsconfig.json` | `templates/tsconfig.app.json` | app | `jest` | `index.ts`, `game.config.ts`, `src/**`, the Shell's `app-env.d.ts` and `navigation/react-navigation.d.ts` |
| `packages/tooling/tsconfig.json` | `templates/tsconfig.tooling.json` | Node | `node`, `jest` | `src/**` |

Rules for these files:

- Every package and app extends the shared strict `tsconfig.base.json`. A workspace `tsconfig.json` may only set `types`, `lib`, `include` and `exclude`. One set of compiler guarantees covers all ~26 apps.
- `game-kit` has `lib: ["ESNext"]` only: no DOM, no React Native globals, so pure code cannot reach for them.
- The tooling tsconfig uses `types: ["node", "jest"]` because tooling has colocated tests.
- Do not add `expo-env.d.ts` or `.expo/types` to any `include`: `expo/types` augments React Native with react-native-web style props and breaks `TextStyle` under the Strict TypeScript API (verified: TS2559 in `app-text.tsx`). Keep `expo-env.d.ts` gitignored and out of every program.
- `check-configs.mjs` fails on any drift from this table (`tsconfig-*` rules).

## How tsc, ESLint and Expo find a file's program

- **`tsc`** checks each file list separately: `npm run typecheck` runs `tsc --noEmit -p tsconfig.json` and then `tsc --noEmit -p` for every `packages/*` and `apps/*` folder. `incremental` with a build-info file under each project's `node_modules/.cache/tsc/` makes a warm run take about 0.5 s per project.
- **ESLint's projectService** (and the editor) picks the nearest `tsconfig.json` that includes the file. Since TypeScript 5.7 it keeps walking up when the nearest one excludes the file. That is how `packages/shell/src/config/**`, `packages/shell/plugins/**` and `apps/*/app.config.ts` reach the root `tsconfig.json` (verified with TypeScript 6.0.3 and typescript-eslint 8.70.1).
- **Expo CLI** needs `apps/<game>/tsconfig.json` to exist.
- A new top-level folder with `.ts` files needs a program that includes it, or ESLint reports "file not found in any of the provided project(s)". Add it to the right world's `include`, never to both.

## What each compiler option buys

```json
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

| Option | What it catches, and the usual fix |
|---|---|
| `strict` | the baseline: `strictNullChecks`, `noImplicitAny` and the rest |
| `noUncheckedIndexedAccess` | `board[row][col]` is `T \| undefined`, so out-of-bounds grid reads are handled: `const cell = row[col]; if (cell === undefined) return ...;` or `?? fallback` |
| `exactOptionalPropertyTypes` | a missing save field differs from one set to `undefined`. Pass optional props with a conditional spread: `{...(testID === undefined ? {} : { testID })}` |
| `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch` | a forgotten `override`, a missing `return`, a silent `case` fall-through |
| `noPropertyAccessFromIndexSignature` | `record.key` on an index signature is written `record['key']`; declared `EXPO_PUBLIC_*` variables keep dot access |
| `erasableSyntaxOnly` | no `enum`, `namespace` or constructor parameter properties; keeps every file runnable by Node type stripping |
| `verbatimModuleSyntax`, `isolatedModules` | `import type` for types, required by Babel/Metro single-file transforms |
| `allowImportingTsExtensions` | allows `./x.ts` imports (the import rule); fine because `noEmit` comes from `expo/tsconfig.base` |
| `useUnknownInCatchVariables` | `catch (error)` is `unknown`; narrow with `error instanceof Error` before reading `.message` |
| `allowUnreachableCode: false`, `allowUnusedLabels: false`, `forceConsistentCasingInFileNames` | dead code, stray labels, case-only import mismatches (macOS ignores case, Linux CI does not) |
| `noErrorTruncation` | full types in error messages, so the whole mismatch is visible |
| `customConditions: ["react-native-strict-api", "react-native"]` | React Native's Strict TypeScript API. Overriding replaces the base array, so `react-native` stays in the list |
| `types: []` | TypeScript 6 defaults to `[]`; each world lists exactly what it may use |

TypeScript does not report unused locals or parameters (`noUnusedLocals` and `noUnusedParameters` stay off). ESLint's `@typescript-eslint/no-unused-vars` owns that, so there is one reporter and `_`-prefixed parameters work.

## `process.env` in app code: app-env.d.ts

Expo inlines `EXPO_PUBLIC_*` variables only for dot access (`process.env.EXPO_PUBLIC_APP_VARIANT`), so each one is declared. App programs have no `@types/node`, so the same file declares `process`, and every app tsconfig lists it in `include`: an app program type-checks the Shell files it imports, and without the entry `tsc -p apps/<game>` fails with TS2591 `Cannot find name 'process'` (verified).

Keep it out of the root (Node) program: there it silently replaces `@types/node`'s `process` (`skipLibCheck` hides the clash) and `process.exitCode` fails with TS2339 (verified). The file is `templates/app-env.d.ts`, destination `packages/shell/src/app-env.d.ts`. Use `declare const`, not `declare var` (`no-var`). Without the `ProcessEnv` entry, `noPropertyAccessFromIndexSignature` rejects `process.env.EXPO_PUBLIC_APP_VARIANT` (TS4111).

A new runtime variable: add it to `ProcessEnv` here, prefix it `EXPO_PUBLIC_`, and read it only with dot access.

## Route types in app programs: react-navigation.d.ts

The Shell types its routes with a global augmentation in `packages/shell/src/navigation/react-navigation.d.ts` (`declare global { namespace ReactNavigation { interface RootParamList extends RootStackParamList {} } }`, written by the navigation-and-routing skill). Nothing imports a global augmentation, so a program sees it only when its `include` lists it. `tsc -p packages/shell` includes it through `src/**/*`, but the app program only follows the imports of its own files into the Shell. Without the entry `RootParamList` stays empty there, and every `navigation.navigate(...)` in the Shell hooks the app imports (`use-home-model.ts`, `use-settings-extras.ts`) fails with TS2769 `No overload matches this call. Argument of type '"Settings"' is not assignable to parameter of type 'never'`. `tsc -p packages/shell` is green at the same time, which makes the error look like a bug in the hook (verified on 2026-09-29 with TypeScript 6.0.3).

So every app tsconfig lists `../../packages/shell/src/navigation/react-navigation.d.ts` next to `app-env.d.ts` (`templates/tsconfig.app.json`, the same file the bootstrap and the new-game scaffold write). Before the navigator exists the path matches no file; an `include` entry that matches nothing is not an error, so the skeleton type-checks from the first day. `check-configs.mjs` fails an app tsconfig without it and names TS2769 in the message.

## Node-world rules (tooling, config composer, config plugins)

Node 26 runs `.ts` files directly by stripping types (the repo's `engines` field requires Node `>=22.18` for this). That imposes five rules on every file in `packages/tooling`, `packages/shell/src/config` and `packages/shell/plugins`:

1. Relative imports carry the `.ts` extension. Node ignores tsconfig `paths`, so there are no aliases: the package name is the alias.
2. Only erasable TypeScript syntax (guaranteed by `erasableSyntaxOnly`).
3. The package declares `"type": "module"` (tooling, shell and game-kit do), so Node does not warn `MODULE_TYPELESS_PACKAGE_JSON`.
4. Testable logic lives in pure modules without top-level side effects (for example `commit-message-rules.ts`); a thin CLI file wraps it and sets `process.exitCode`. Jest transforms these modules with Babel, so pure modules do not use `import.meta`.
5. A deep import into a package that has no `exports` map needs the file's `.js` extension under Node ESM: config plugins import `expo/config-plugins.js`, not `expo/config-plugins` (verified: `npx expo config` fails with `ERR_MODULE_NOT_FOUND ... Did you mean to import "expo/config-plugins.js"?`). Type-only imports (`import type { ExpoConfig } from 'expo/config'`) are erased and need nothing.

Node refuses to type-strip files inside a `node_modules` path. Workspace packages work because npm links them and Node follows the link to `packages/...`; never publish them or install them as tarballs.

## Verified facts

On 2026-09-26, in a throwaway npm-workspaces monorepo with the canonical layout (Node 26.4.0, npm 11.17.0, TypeScript 6.0.3, ESLint 9.39.5, typescript-eslint 8.70.1, eslint-config-expo 57.0.2, React Native 0.86.3, React 19.2.3, Jest 29.7 + jest-expo 57.0.5, Prettier 3.9.9):

- All six tsconfig files type-check; `tsc -p` per project with `incremental` takes about 0.5 s warm.
- A type-only import from an app file into `with-shell.ts` fails (`process`, `node:fs` unknown), which is why `GameConfig` lives in a neutral file.
- Adding `expo-env.d.ts` to an app program breaks `TextStyle` (TS2559).
- On 2026-09-29, in a monorepo with the Shell's Home and Settings screens: `tsc -p packages/shell` green, `tsc -p apps/line-siege` TS2769 on every `navigation.navigate(...)` until the app tsconfig listed `../../packages/shell/src/navigation/react-navigation.d.ts`; a fresh skeleton whose app tsconfig lists the file before it exists type-checks cleanly.
- Type-aware lint rules work in Node-world files through the root `tsconfig.json` (ancestor search).
- Re-checked on 2026-09-28 for this skill: the templates type-check two verified workspaces (170 and 168 files) unchanged.
