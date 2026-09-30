# When a gate fails: limits and fixes

Every custom rule message names the spec item or decision and the fix. Read the whole output, fix the code, the test or the translation, never the gate, and rerun.

## Contents

- The procedure
- Fix by failure
- The size and complexity limits
- When a limit trips
- The never list
- When the gate itself looks wrong

## The procedure

1. **Read the whole output.** Messages say what to use instead (for example "Spec N11: use start/end (marginStart, paddingEnd, start, end), never left/right.").
2. **Fix the code, the test or the translation**, not the gate (table below).
3. **Rerun the specific script**, then `npm run -s check:fast`.
4. **A flaky test**: reproduce with the printed seed (`npx jest --ci --randomize --seed=<n> -i <file>`, or fast-check's `seed` and `path`) and make it deterministic (fake clock, seeded random numbers, fake timers for UI timers only). Retries are not a fix.

## Fix by failure

| Failure | Fix |
|---|---|
| Prettier | `npm run format` (the edit hook normally prevents this) |
| ESLint limit (`max-lines`, `complexity`, ...) | split by responsibility (next sections) |
| ESLint restricted API | use the Shell alternative named in the message (the clock port, the seeded random-number generator, the Shell text component, a Shell dialog, the port) |
| `tsc` | fix the types; never `as unknown as`, `any` or `!` to silence it |
| Failing test | fix the code; change the test only if the spec changed, with a `Spec-Change:` trailer |
| Coverage below threshold | add tests for the uncovered behaviour (not assertion-free tests: Stryker and `jest/expect-expect` catch those); a native adapter, Skia or frame-callback module, composition file or tooling entry point gets `// device-only: covered by <check>` in its first 6 lines instead (never a fake or a pure helper) |
| Golden or screenshot diff | find the cause; update the golden (`jest -u` on that file, a new baseline) only if the change is intended, then `Gate-Change:` |
| knip | delete the dead code or dependency, or add the missing dependency; exports that only a later screen uses are expected while `shell-slice.json` exists (verify skips the export kinds then); a new ignore entry only for a tool-only reference, with the owner, a `Gate-Change:` trailer and its reason in [root-files.md](root-files.md) |
| `audit:network`, `audit:licenses` | remove the dependency or the network path; an exception needs the owner |
| `check-deps` | `npx expo install --fix` in the app; review and approve install scripts; delete an expired release-age block. A `WARN` for an Expo patch younger than 7 days is not a failure: install it on the due date it names |
| The guardrail | restore the gate to its expected value; never edit `quality-gates.json` to match |
| `commit-msg` | rewrite the message (for `spec-ref-missing`, name the spec lines the change serves); add the trailer the check asks for. The rules are the same as `check-commits.mjs`, so check a planned message with that script first |
| `test:sim` "No tests found", `i18n:verify` or `audit:network` script missing | expected only before the build step named in gates-overview.md ("When verify is green"); after it, a real failure. Never `--passWithNoTests` or a stub |
| This skill's `check-gate-wiring.mjs` | restore the file or value it names from `templates/` |
| This skill's `check-bypasses.mjs` | remove the suppression, ignore comment, bypass flag or stale exception it names |

## The size and complexity limits

All limits are ESLint errors on every `.ts` / `.tsx` file; there is no warning tier (with `--max-warnings 0` a warning fails anyway, and two thresholds invite gaming).

| Metric | Limit | Tests | Why |
|---|---|---|---|
| Lines per file (code only) | 250 | 400 | a 250-line file is read whole in one read and fails in one place |
| Lines per function (`.ts`) | 40 | off | between Clean Code's 20 and ESLint's default 50 |
| Lines per component (`.tsx`) | 80 | off | JSX is verbose; bounded further by JSX depth and one component per file |
| Cyclomatic complexity | 10, `variant: 'modified'` | 10 | McCabe's limit; `modified` counts a whole `switch` once, so exhaustive switches over unions pass |
| Cognitive complexity | 15 | 15 | bounds the nesting and branching that `modified` no longer counts |
| Nesting depth | 3 | 3 | more than 3 levels means the function does too much |
| Parameters | 3 | 3 | beyond three, pass one options object with named fields |
| Nested callbacks | 3 | 4 | tests need describe -> it -> property -> callback |
| JSX depth | 5 (root = 0) | 5 | a sixth level fails; extract a component |
| Components per file | 1 | any | one exported unit per file, easy to find |
| Classes per file | 1 | 1 | the same |
| Duplicate string literal | 3 occurrences | off | name a repeated literal once |
| Line width | 100 (Prettier) | 100 | |

## When a limit trips

Split by responsibility, never by line count. Never inline-compress code, join lines or move logic into JSON to get under a limit.

- A long function: extract the steps into named pure functions in the same file, or into a sibling module with its own test when they form their own responsibility.
- High complexity: replace condition chains with a lookup table (an `as const` object keyed by a union) or an exhaustive `switch` over a union.
- Deep JSX: extract a child component into its own file with a `<Component>Props` type.
- A long file: split by responsibility (rules vs scoring vs generation), never into `part-1.ts` / `part-2.ts`.
- Too many parameters: one `readonly` options object type named `<Function>Options`.
- Large static data (level tables, word lists, palettes) belongs in `.json`, which has no line limit.

## The never list

Never add `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `it.skip`, `.only`, `jest.retryTimes`, `--no-verify`, `LEFTHOOK=0`, `--passWithNoTests` in a new place, `jest -u` in a script, an istanbul or Stryker ignore comment, a lower threshold, a broader exemption glob, or a `min-release-age-exclude` without a dated block. `check-bypasses.mjs` finds every one of these.

## When the gate itself looks wrong

A false positive, a rule that contradicts the spec or the platform decisions, or a tool bug: stop that line of work and send the owner one note (`templates/gate-question.md`) with the gate, the file and line, the exact message, why it looks wrong, and the smallest proposed change. Continue with other work if possible. Change the gate only after the owner agrees, in one commit that also updates `quality-gates.json`, with a `Gate-Change:` trailer.
