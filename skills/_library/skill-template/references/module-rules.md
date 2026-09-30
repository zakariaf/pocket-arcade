# Module rules for pure helpers

What a pure helper module in `packages/game-kit/src/` looks like, and why each rule exists. Read this before writing or reviewing a helper.

## Contents

- Named exports only
- Kebab-case file names
- Pure and deterministic
- One job per module
- Worked example

## Named exports only

Write `export function clampValue(...)` and import it as `import { clampValue } from './clamp-value.ts'` (with the `.ts` extension: Node type stripping needs it).

- A default export lets every importer pick its own name, so the same function turns up as `clamp`, `clampValue` and `limit`, and a search for one name misses the others.
- Named exports make an unused or misspelled import a type error instead of a silent `undefined`.
- The checker reports `export default` as `no-default-export`, with the line.

## Kebab-case file names

Name files with lowercase words joined by hyphens: `clamp-value.ts`, and its test `clamp-value.test.ts`.

- macOS file systems ignore case but Linux CI does not, so `ClampValue.ts` imported as `./clampValue` works locally and fails in CI.
- One style means a file name can be derived from the function name without looking.
- The checker reports other names as `file-name-kebab`.

## Pure and deterministic

- No React, React Native, Expo or Shell imports: a helper must run in plain Node tests.
- No `Date.now()`, `new Date()` or `Math.random()`: pass the time or a seeded random source in as an argument, so replays and daily challenges give the same result on every device.
- No module-level mutable state. Return new values instead of changing the arguments.

## One job per module

A module holds one exported function (plus its types) or a small family of functions around one idea. When a second unrelated idea appears, start a new file.

## Worked example

`templates/pure-module.ts` is the starting point. After filling in the placeholders it reads:

```ts
// Clamps a value into a closed range.
// Pure and deterministic: no React, React Native, Expo or Shell imports, no clock and no Math.random().

export type ClampRange = {
  readonly min: number;
  readonly max: number;
};

export function clampValue(value: number, range: ClampRange): number {
  if (range.min > range.max) {
    throw new RangeError(`min ${String(range.min)} is greater than max ${String(range.max)}`);
  }
  return Math.min(range.max, Math.max(range.min, value));
}
```
