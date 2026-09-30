# Size and complexity limits, and how to split code

The limits every `.ts`/`.tsx` file meets, why each number was chosen, how the lines are counted, and what to do when one trips. Read this when a limit error appears or before writing a large module or component.

## Contents

- The limits table
- How lines are counted
- When a limit trips
- Data belongs in JSON
- Why there is no warning tier

## The limits table

All limits are ESLint errors on every `.ts`/`.tsx` file; tests have their own column.

| Metric | Limit | Tests | ESLint default | Rationale |
|---|---|---|---|---|
| Lines per file (code only) | 250 | 400 | 300 | A 250-line file is read whole in one read call and fits 2-3 agent viewer windows. Defect studies show size predicts defects but no universal optimum (Hatton: a 200-400 sweet spot; El Emam: no threshold effect), so 250 is an engineering choice below the default |
| Lines per function (`.ts`) | 40 | off | 50 | between Clean Code's ~20 and the ESLint default; within the Linux kernel's "one or two screenfuls" |
| Lines per function (`.tsx`, components) | 80 | off | 50 | JSX is verbose; bounded further by JSX depth 5 and one component per file |
| Cyclomatic complexity | 10, `variant: 'modified'` | 10 | 20 | McCabe's limit (NIST SP 500-235). The classic count adds 1 per `case`, `?.`, `??` and default parameter, so an exhaustive 11-case switch over a union would fail; `modified` counts a whole `switch` once (verified) |
| Cognitive complexity | 15 | 15 | 15 (Sonar) | bounds the nesting and branching that `modified` complexity no longer counts |
| Nesting depth | 3 | 3 | 4 | "if you need more than 3 levels of indentation, you're screwed anyway" (kernel style) |
| Parameters | 3 | 3 | 3 | beyond three, pass one options object with named fields. Function **types** count too (`(a, b, c, d) => void` in a type fails) |
| Nested callbacks | 3 | 4 | 10 | tests need describe → it → property → callback |
| JSX depth | 5 (root = 0) | 5 | none | a sixth level fails (verified); extract a component |
| Components per file | 1 | any | none | one exported unit per file, easy to locate |
| Classes per file | 1 | 1 | none | same |
| Duplicate string literal | 3 occurrences | off | none | name a repeated literal once |
| Line width | 100 (Prettier) | 100 | n/a | Airbnb's `max-len` |

Rule names: `max-lines`, `max-lines-per-function`, `complexity`, `sonarjs/cognitive-complexity`, `max-depth`, `max-params`, `max-nested-callbacks`, `react/jsx-max-depth`, `react/no-multi-comp`, `max-classes-per-file`, `sonarjs/no-duplicate-string`. Also on: `sonarjs/no-identical-functions`, `sonarjs/no-collapsible-if`, `sonarjs/no-nested-conditional`, `sonarjs/no-all-duplicated-branches`, `sonarjs/no-identical-conditions`, `sonarjs/no-inverted-boolean-check`, `no-nested-ternary`.

Test files are `**/*.test.{ts,tsx}`, `test/**`, `jest.setup.ts` and `__mocks__/**`.

## How lines are counted

- `max-lines` and `max-lines-per-function` use `skipBlankLines: true` and `skipComments: true`: only lines holding code count. A line with code and a trailing comment counts.
- A function is counted from its first line (the `function` keyword, or the `(` of an arrow) to its closing brace, including the signature.
- Nested functions count inside their parent too: a 30-line component with a 20-line inner handler is 30 lines for the component and 20 for the handler.
- `IIFEs: true`: immediately invoked functions count as functions.
- `check-source.mjs` counts the same way. On two verified workspaces (338 files), with the limits lowered to 20 lines and 1 parameter to make ESLint report everything, its counts matched ESLint's for all 64 reported functions and all 268 reported parameter lists, with no extra reports (2026-09-28).

## When a limit trips

The limit is a symptom detector, not a target. Split by responsibility, never by line count, and never inline-compress code, join lines or move logic into JSON to get under a limit.

| Limit tripped | Move |
|---|---|
| Long function | Extract the steps into named pure functions in the same file (each gets a TSDoc line if exported) or, if they form their own responsibility, a sibling module with its own test |
| High complexity or cognitive complexity | Replace condition chains with a lookup table (`as const` object keyed by a union) or an exhaustive `switch` over a union |
| Deep nesting | Early returns (guard clauses), then extract the inner block into a named function |
| Too many parameters | One `readonly` options object type named `<Function>Options` |
| Deep JSX, long component | Extract a child component into its own file with a `<Component>Props` type; move data shaping into a `use-<screen>-model.ts` hook |
| Long file | Split by responsibility (rules vs scoring vs generation), never into `part-1.ts`/`part-2.ts` |
| Duplicate string | A named constant (`const COLUMN_CLEARED = 'column-cleared'`), or a table |
| Two components in one file | One file per component; the file name is the component name in kebab-case |

`examples/splitting-a-long-function.md` walks through a real 44-line, complexity-12 function and its split.

## Data belongs in JSON

Large static data (level tables, word lists, palettes) goes in `.json`, not `.ts`: data is not logic, has no line limit, and loads without parsing TypeScript. Import it with a default import (`import en from './en.json';`).

## Why there is no warning tier

With `--max-warnings 0` a warning would fail anyway, and two thresholds invite gaming ("it is only a warning"). `check-configs.mjs` fails on any `'warn'` severity (`eslint-warn`) and on any limit value other than the ones above (`eslint-limit-changed`).
