# House policies: comments, errors, async, immutability, injection, imports

How code is written inside the limits: what a comment says, how expected failures travel, how promises are handled, why data is immutable, how dependencies arrive, and how imports are spelled. Read the matching section when writing error handling, async code, a service or a new module.

## Contents

- Comments and TSDoc
- Error handling
- Async code
- Immutability and purity
- Dependency injection
- Imports

## Comments and TSDoc

- Line 1 of every `.ts`/`.tsx` file is `// <repo-relative path>` (for example `// packages/shell/src/ui/app-text.tsx`), so snippets and tool output always show where code lives.
- Every exported function, type and constant in `packages/game-kit`, every port type, store, reducer and hook has a one-sentence TSDoc summary (`/** ... */`) that states the contract, the unit or the reason, not a paraphrase of the code: `/** Returns the next uint32 and the advanced state; never mutates its input. */`. Add `@param`/`@returns` only when a name cannot carry the meaning. The agent reads summaries before bodies.
- Inside functions, comment *why*, never *what*; cite the spec section (`spec 8.8`) when a line exists because of it.
- English, full sentences, no ASCII art, no author names or dates, no `TODO`/`FIXME`/`HACK` (`no-warning-comments`), no commented-out code (`sonarjs/no-commented-code`), no `eslint-disable` (inert and reported).

## Error handling

Decide by asking "can this happen in a correct program?"

| Situation | Mechanism | Example |
|---|---|---|
| Expected failure with reasons | return `Result<TValue, TError>`; `TError` is a `kind` union | a malformed link parameter, corrupt or newer save, store unavailable, purchase cancelled (a move `listMoves` does not list is not one: `applyMove` throws a `RangeError`, the engine contract) |
| Expected absence, no reason needed | return `T \| null` | `intentToMove` finds no move; a hit test misses |
| External SDK failure | the adapter catches, maps to a `Result` or a typed state, and records unexpected ones through `ErrorLogPort` | ad load `no-fill` is expected (silent); an unknown error code is recorded |
| Broken invariant, contract misuse, impossible state | `throw new Error(message, { cause })` | a hook used outside its provider; a config value outside its union |
| Render error | the Shell error boundary records it and shows the recovery screen | never a crash loop |
| Error on the UI thread (frame callback) | `try/catch` in the callback → pause the game → `scheduleOnRN` to record it | |
| Anything uncaught | the Shell's global handler and unhandled-rejection tracker record it | a last resort, not a strategy |

The type system then forces every caller to handle every expected case (`switch-exhaustiveness-check` over the `kind` union).

The shared result type lives in game-kit so rules, Shell and apps use one shape: `templates/result.ts`, destination `packages/game-kit/src/contract/result.ts`. A parser of outside input (a link parameter, a save field) returns it instead of throwing: `examples/parse-level-param.ts` and its test. Game rules are the exception: the engine contract makes `applyMove` throw a `RangeError` for a move `listMoves` does not list, because that is a programming error, not an expected case (game-rules-engine).

The error log port (spec 8.14). `record` never throws and never rejects, so it is safe inside any `catch`:

```ts
// packages/shell/src/services/error-log/error-log-port.ts
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

/**
 * Spec 8.14: the local error log (never leaves the device). `record` never throws and never
 * rejects. Adapter: sqlite-error-log-adapter.ts (newest 200 rows). Fake: fake-error-log.ts.
 */
export type ErrorLogPort = {
  readonly record: (source: ErrorSource, error: unknown) => void;
  /** Newest first. */
  readonly entries: () => readonly ErrorLogEntry[];
};
```

`ErrorSource` values are kebab-case and stable (they appear in exported logs). The port file and its in-memory fake (`createFakeErrorLog`) are templates of the architecture-and-boundaries skill.

Rules for `catch`:

- `catch (error)` is `unknown`; narrow with `error instanceof Error` before reading `.message`.
- Every `catch` and `.catch(...)` either maps the error to a `Result`/typed state, records it through `ErrorLogPort` and continues with a defined fallback, or rethrows with context: `throw new Error('save migration v3→v4 failed', { cause: error })`. Empty catch blocks are errors.
- Only throw `Error` objects (`only-throw-error`); reject promises with `Error` objects (`prefer-promise-reject-errors`).
- A best-effort cosmetic effect may ignore its own failure inside its adapter, as the haptics adapter does (`.catch(() => undefined)`); prefer recording the first failure per session through `ErrorLogPort`. Nowhere else.
- User-facing error text is a translated message chosen from the error `kind` (the Shell dialogs), never `error.message`.

## Async code

- **No floating promises.** Await it, return it, or end it with `.catch(reportError)`; `void promise` does not count (`ignoreVoid: false`).
- **Synchronous handlers.** A function named `handleX`, or an inline function passed to an `on*` prop, is never `async`. Fire-and-forget work ends in `.catch(reportError)`, where `reportError` comes from `useReportError(source)` (`examples/use-report-error.ts`, used by `examples/buy-button.tsx`).
- **Timeouts belong to adapters.** Play never waits for the network (spec 8.8): every await on an SDK that can hang is wrapped, and a timeout is an expected failure, not an exception (`examples/with-timeout.ts` and its test).
- No `async` Promise executors (`no-async-promise-executor`); no `new Promise` around code that is already async.
- Run independent awaits together (`Promise.all`); await sequentially only when order matters (migrations v1→v2→v3).
- No promises, `await` or `setTimeout` in worklets; the UI thread talks to JS through `scheduleOnRN`.
- `setTimeout` always gets an explicit delay, and every timer is cleared (in `finally` or an effect cleanup).
- Time comes from `ClockPort` (or the frame timestamp on the UI thread), never from `Date.now()`, `new Date()` or `performance.now()`.

## Immutability and purity

- Types: `readonly` on every property, `readonly T[]` for arrays, `Readonly<Record<...>>` for maps. Constant tables: `as const` (with `satisfies` when a type must be checked).
- Updates: spread into a new object (`{ ...state, theme: action.theme }`), `map`/`filter` into new arrays. Never mutate a parameter (`no-param-reassign` with `props: true`); `const` unless reassigned (`prefer-const`); class fields `readonly` where possible (`prefer-readonly`).
- Sort without mutating: `[...list].sort(compare)`.
- Engine state is JSON-serialisable: no `Map`, `Set`, class instances, functions or `undefined` values in a save, run log or replay.
- The only exceptions: the real-time loop in `apps/*/src/sim/**` mutates typed arrays inside Reanimated shared values in place (no per-frame allocation), and game-kit's `geom/spatial-hash.ts` fills caller-owned scratch buffers. The config relaxes `no-param-reassign` only for those files.
- Purity (rules, levels, game-kit): output depends only on inputs; randomness comes from the seeded RNG state inside the game state; time arrives as a parameter (`nowMs`, `seed`). No React, React Native, Expo, Skia or Shell imports.

## Dependency injection

- The composition root creates each adapter once: `createDeviceAdapters()` in `packages/shell/src/app/device-adapters.ts` (the only file that opens native modules; tests pass fakes instead), called once by `createShellApp` in `create-shell-app.tsx`; `create-shell-parts.ts` builds the services from them and the app root passes the set to `ServicesProvider`. React Context is used for dependency injection only (services, theme, game module), never for app state.
- Components read ports with `useServices()`; stores and services receive ports as factory arguments (`createPremiumService({ purchase, saveStore, clock })`); pure functions receive plain values (`nowMs: number`, `seed: number`).
- Tests render with fakes through `renderWithShell`, which passes only the ports a test gives it (any other port throws on first use), so no test needs `jest.mock` for our own modules. Root `__mocks__/` exist only for vendor SDKs that crash when imported in Jest.
- No service locators, no mutable module-level registries, no importing an adapter from a screen or store, no module-level singletons that touch native code (except inside an adapter, such as the AudioContext).

## Imports

| Import | Form | Example |
|---|---|---|
| Same folder | `./file.ext` | `import { ok } from './result.ts';` |
| Sub-folder of the current folder | `./folder/file.ext` | `import { synthesizeRecipe } from './synth/synthesize-recipe.ts';` |
| Other folder, same package | package self-reference | `import { AppText } from '@e07/shell/ui/app-text.tsx';` |
| Other workspace | package name | `import { createRng } from '@e07/game-kit/rng/sfc32.ts';` |
| npm package | bare name, public entry only | `import { create } from 'zustand';` |
| Types | separate `import type` | `import type { ExpoConfig } from 'expo/config';` |
| JSON data | default import of the file | `import en from './en.json';` |

- Workspace packages expose `"exports": { "./*": "./src/*" }` (the Shell also `"./plugins/*": "./plugins/*"`), so `@e07/shell/ui/app-text.tsx` means `packages/shell/src/ui/app-text.tsx`. `@e07` is a placeholder scope until the framework is named; the rules apply to whatever scope the packages use.
- No barrel files and no re-exports for convenience; import the file that defines the symbol.
- Which package may import which is the dependency-direction rule: game-kit ← shell ← apps, tooling imports anything and nothing imports tooling (the architecture-and-boundaries skill owns the zones).
