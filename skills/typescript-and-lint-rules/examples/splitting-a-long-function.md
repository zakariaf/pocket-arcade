# Worked example: splitting a function that trips the limits

A realistic first draft of a level-scoring rule, the four errors the canonical ESLint config reports for it, and the split that fixes them by responsibility. The "after" is the real file [score-level.ts](score-level.ts) with its test [score-level.test.ts](score-level.test.ts); both pass `tsc`, ESLint `--max-warnings 0`, Prettier and Jest.

## Before

```ts
// apps/line-siege/src/rules/score-level.ts (first draft)
export function scoreLevel(
  result: LevelResult,
  rule: StarRule,
  isDaily: boolean,
  hintsUsed: number,
): LevelScore {
  let stars: 0 | 1 | 2 | 3 = 0;
  if (result.isWon) {
    if (rule.kind === 'par') {
      if (result.moves <= rule.par) {
        stars = 3;
      } else if (result.moves <= rule.par + 2) {
        stars = 2;
      } else {
        stars = 1;
      }
    } else {
      let reached = 0;
      for (const threshold of rule.thresholds) {
        if (result.score >= threshold) {
          reached += 1;
        }
      }
      if (reached === 3) {
        stars = 3;
      } else if (reached === 2) {
        stars = 2;
      } else if (reached === 1) {
        stars = 1;
      }
    }
  }
  let points = 0;
  if (isDaily) {
    points = stars * 200;
  } else {
    points = stars * 100;
  }
  points = points - hintsUsed * 25;
  if (points < 0) {
    points = 0;
  }
  return { stars, points };
}
```

What `npx eslint` reported on 2026-09-28 (all at the function's first line):

| Rule | Message |
|---|---|
| `max-lines-per-function` | Function 'scoreLevel' has too many lines (44). Maximum allowed is 40. |
| `max-params` | Function 'scoreLevel' has too many parameters (4). Maximum allowed is 3. |
| `complexity` | Function 'scoreLevel' has a complexity of 12. Maximum allowed is 10. |
| `sonarjs/cognitive-complexity` | Refactor this function to reduce its Cognitive Complexity from 24 to the 15 allowed. |

`check-source.mjs` reports the first two as well (`max-lines-per-function`, `max-params`), so the problem shows up even before `node_modules` exist.

## The wrong fixes

- Joining lines (`if (a) { stars = 3; } else if ...` on one line) or removing blank lines: the limit counts code lines, and compressed code is worse to read. Prettier would undo it anyway.
- Moving the body into `score-level-part-2.ts`: a split by line count, not by responsibility.
- An `eslint-disable` comment: inline config is switched off, the comment does nothing, and `check-source.mjs` reports it.

## The split, step by step

1. **Four parameters become one options object** named after the function: `ScoreOptions` with `readonly` fields. Call sites name every argument, so `isDaily` and `hintsUsed` can no longer be swapped.
2. **Each responsibility gets a named pure function.** Stars against par (`starsByPar`), stars against thresholds (`starsByScore`), and the dispatch over the rule (`starsFor`). Each is testable on its own and exported only when a test or a caller needs it.
3. **A condition chain becomes a lookup table.** `reached === 3 ? 3 : ...` becomes `STARS_BY_THRESHOLDS_REACHED[reached] ?? 0` (the `?? 0` is required by `noUncheckedIndexedAccess`). `isDaily ? 200 : 100` becomes the `POINTS_PER_STAR` table, which also names the numbers.
4. **The union is handled with an exhaustive `switch`.** A new `StarRule` kind becomes a compile error in `starsFor` (`switch-exhaustiveness-check`) instead of silently scoring zero.
5. **Mutation disappears.** `let stars` and `let points` with reassignments become `const` values computed once (`prefer-const`, immutability policy).

## After

The result is [score-level.ts](score-level.ts): `scoreLevel` is 6 code lines, every function is under complexity 4, and the test file covers each piece. The same moves apply to any limit:

| Limit tripped | Move |
|---|---|
| Function too long | Extract named steps (pure functions in the same file, or a sibling module with its own test) |
| Complexity or cognitive complexity | Lookup table keyed by a union, or an exhaustive `switch` over the union |
| Nesting depth | Early returns, then extract the inner block |
| Too many parameters | One `readonly` options object named `<Function>Options` |
| JSX too deep, component too long | Extract a child component into its own file with a `<Component>Props` type |
| File too long | Split by responsibility (rules, scoring, generation), never `part-1`/`part-2` |
