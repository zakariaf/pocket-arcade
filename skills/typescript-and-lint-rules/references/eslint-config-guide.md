# The ESLint config: how it is built, read and changed

The one `eslint.config.mjs` for the whole monorepo (the complete file is `templates/eslint.config.mjs`), the versions it was verified with, how its blocks cascade, and the only allowed way to add an exception. Read this before touching `eslint.config.mjs`, when a lint message is unclear, or when a new folder, adapter or exemption is needed.

## Contents

- Versions and install
- The stack and the one-config rule
- Blocks, in order
- File groups
- Shared option lists (why exception blocks rebuild whole lists)
- The file-exact exemptions
- Adding an exception, step by step
- Codes that appear in lint messages
- Prettier
- Troubleshooting

## Versions and install

Verified on 2026-09-26; `check-configs.mjs` (rule `package-pin`) compares the root `package.json` with this table.

| Package | Pin | Notes |
|---|---|---|
| typescript | 6.0.3 | Expo SDK 57 range `~6.0.3`, saved exact. npm `latest` is 7.x, but typescript-eslint 8.70.1 supports `>=4.8.4 <6.1.0` |
| eslint | 9.39.5 | exact pin, `maintenance` tag. ESLint 10 breaks eslint-plugin-react used by eslint-config-expo 57 (ESLint 9 is EOL since 2026-08-06; dev-only) |
| eslint-config-expo | 57.0.2 | brings eslint-plugin-import 2.32.0, eslint-plugin-react-hooks 7.1.1 (React Compiler rules), eslint-import-resolver-typescript |
| typescript-eslint | 8.70.1 | |
| eslint-plugin-sonarjs | 4.2.1 | LGPL-3.0-only, dev-only (never shipped) |
| eslint-plugin-react-native | 5.0.0 | last release Dec 2024; peer ESLint 9 at most |
| @react-native/eslint-plugin | 0.86.3 | matches the react-native version |
| eslint-plugin-check-file | 3.3.2 | |
| eslint-plugin-jest | 29.16.6 | |
| eslint-plugin-testing-library | 7.16.2 | |
| eslint-plugin-formatjs | 8.1.0 | only `no-literal-string-in-jsx` |
| eslint-config-prettier | 10.1.8 | |
| globals | 17.12.0 | Node globals for `*.config.js` files |
| prettier | 3.9.9 | |
| @types/node | 26.4.1 | matches the Node 26.4 runtime |

Install from the repo root (`.npmrc` sets `save-exact=true`):

```sh
npm install -D eslint@9.39.5 typescript-eslint@8.70.1 eslint-plugin-sonarjs@4.2.1 \
  eslint-plugin-react-native@5.0.0 @react-native/eslint-plugin@0.86.3 eslint-plugin-check-file@3.3.2 \
  eslint-plugin-jest@29.16.6 eslint-plugin-testing-library@7.16.2 eslint-plugin-formatjs@8.1.0 \
  eslint-config-prettier@10.1.8 globals@17.12.0 prettier@3.9.9 @types/node@26.4.1 \
  typescript@6.0.3 eslint-config-expo@57.0.2
```

The root `.npmrc` sets `save-exact=true` and `min-release-age=7`. Until 2026-10-03 some of these pins (prettier 3.9.9, eslint-plugin-formatjs 8.1.0) are younger than seven days and install only through the dated `# exclude-block expires=2026-10-03` block that monorepo-bootstrap writes. typescript-eslint 8.70.1 is 7 days old since 2026-09-29 and is not in the block: the root `overrides` pin it and all ten `@typescript-eslint/*` packages at 8.70.1, so no second copy of the plugin can float in (`Cannot redefine plugin "@typescript-eslint"`). If npm refuses a version as too young, never lower the age or change the pin: hand off to dependency-management, which owns the block.

Upgrade triggers: ESLint 10 only when eslint-config-expo declares support; TypeScript 7 only when typescript-eslint supports it. Both are owner-visible changes: stop and ask.

## The stack and the one-config rule

`eslint-config-expo/flat` → typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` (projectService) → project rules → `eslint-config-prettier` last.

- Every rule is an error, never a warning. Lint runs with `--max-warnings 0` everywhere (`"lint": "eslint . --max-warnings 0"`), inline `eslint-disable` comments are switched off (`noInlineConfig`), and unused directives are errors.
- There is exactly one config at the repo root. It also carries rules other skills own (UI primitives, app zones, the expo-iap adapter block, the `__mocks__` naming block), merged into this one listing so no copy can drift. The monorepo-bootstrap skill writes the same file (byte for byte) when it creates the repo; this skill maintains it afterwards.
- Run ESLint only through the npm scripts (`npm run lint`, `npm run check:fast`, the hooks). Never pass `--rule`, `--no-inline-config`, `--config` or similar flags: CLI flags bypass the config and the guardrail cannot see them (`check-configs.mjs` rule `lint-script`).

## Blocks, in order

Later blocks override earlier ones for the files they match.

| Block | Files | Purpose |
|---|---|---|
| ignores | generated folders | `ios/`, `android/`, `.expo/`, reports, `tools/`, `skills/`, `.claude/`, `...PRE_EXISTING` |
| 0 | all | `noInlineConfig`, unused-directive errors |
| 1 | all | `eslint-config-expo/flat`, plugins, TypeScript import resolver |
| 2 | `**/*.{ts,tsx}` | typescript-eslint strict + stylistic (type-aware), naming, promises, comments |
| 3 | `**/*.{ts,tsx}` | size and complexity limits (80 lines for `.tsx`) |
| 4 | `**/*.{ts,tsx}` | exports, import order and cycles, banned packages, `../` ban, file names |
| 5 | `RUNTIME` | network (N3), clock and randomness, RTL styles, i18n, vendor SDKs, UI primitives and memo, store hooks need a selector, React Native rules |
| 5 (shell), 5-zones, 5-i18n, 5a, 5b | Shell, app sources, `.tsx` sources, `PURE`, `DETERMINISTIC` | dependency direction, app zones on resolved paths, FormatJS JSX text and props, purity, integer-safe math |
| 5c | named files | the only exemptions (next sections) |
| 6 | `NODE_CODE` | Node APIs, network and console allowed in tooling and config; the wall clock only in `packages/tooling/src/clock/system-clock.ts`; default exports in `app.config.ts` and config plugins |
| 7 | `TESTS` | Jest, Testing Library, relaxed limits, `.d.ts` merging, mocks |
| 8 | JS config files | Node globals, no type information |
| 9 | all | `eslint-config-prettier` last |

The skill library (`skills/**`) and `.claude/**` are globally ignored: they hold templates and deliberately bad fixtures that belong to no tsconfig program.

`PRE_EXISTING` (declared just above `defineConfig`) lists the top-level folders and files that were in the repo before the monorepo and are not code: knowledge folders, design exports, notes (for example `['handbook/**', 'research/**', 'README.md']`). The template ships it empty; fill it once, together with the same entries in `.prettierignore`, or ESLint lints stray `.js`/`.mjs` tools inside them and fails. `check-configs.mjs` lists every top-level entry that is outside the monorepo layout and not ignored (`ignore-pre-existing`). A folder added at the root later gets a place in the layout instead.

## File groups

The groups at the top of the file map the canonical layout. A new top-level folder needs a new glob here, or its files silently get only the generic rules.

| Group | Globs | Meaning |
|---|---|---|
| `RUNTIME` | `apps/*/index.ts`, `apps/*/game.config.ts`, `apps/*/src/**/*.{ts,tsx}`, `packages/game-kit/src/**/*.ts`, `packages/shell/src/**/*.{ts,tsx}` | ships inside an app bundle |
| `NODE_CODE` | `apps/*/app.config.ts`, `packages/shell/src/config/**/*.ts`, `packages/shell/plugins/**/*.ts`, `packages/tooling/src/**/*.ts` | runs in Node |
| `PURE` | `packages/game-kit/src/**/*.ts`, `apps/*/src/{rules,levels}/**/*.ts` | no React, React Native, Expo, Skia or Shell imports |
| `DETERMINISTIC` | `packages/game-kit/src/**/*.ts`, `apps/*/src/{rules,levels,sim,geom}/**/*.ts` | integer-safe math only |
| `TESTS` | `**/*.test.{ts,tsx}`, `test/**/*.{ts,tsx}`, `jest.setup.ts`, `__mocks__/**/*.{ts,tsx}` | relaxed limits, Jest rules |
| `ADAPTERS` | `packages/shell/src/services/*/*-adapter.ts`, `*-save-store.ts`, `*-sql-driver.ts` | the only files that import a vendor SDK |

## Shared option lists (why exception blocks rebuild whole lists)

In flat config a later block **replaces** a rule's options for the files it matches; it does not merge (verified). So the file keeps shared lists (`BANNED_PACKAGE_PATHS`, `RUNTIME_PATHS`, `SYNTAX`, `RESTRICTED_PROPERTIES`) and every block that narrows a rule rebuilds it from those lists minus the one item it exempts:

- `withoutProperty('Date', 'now')` for the clock adapter,
- `runtimeSyntax(['newDate'])` to drop one `no-restricted-syntax` entry,
- `without(RUNTIME_PATHS, PRESSABLE_IMPORT)` to lift one import ban,
- `restrictedImports({ paths, patterns })` always prepends `BANNED_PACKAGE_PATHS` and `PARENT_IMPORT`.

A block that writes a fresh short list (for example `'no-restricted-imports': ['error', { paths: [x] }]`) silently drops every other ban for those files. That is the most likely way to weaken the config by accident.

## The file-exact exemptions

Exemptions name single files on purpose:

| API | Only in |
|---|---|
| `Date.now`, `new Date()` (app) | `packages/shell/src/services/clock/*-adapter.ts` |
| `Date.now`, `new Date()` (Node) | `packages/tooling/src/clock/system-clock.ts` (`new Date(value)` stays allowed in Node code) |
| `Date.now`, `performance.now` (test builds) | `packages/shell/src/app/perf/cold-start.ts`, `use-cold-start-mark.ts`, `save-benchmark.ts` |
| `I18nManager` | `packages/shell/src/i18n/direction.ts` |
| `textAlign: 'left' \| 'right'`, the `Text` import | `packages/shell/src/ui/app-text.tsx` |
| remote URL literals | `packages/shell/src/config/external-links.ts` (store, privacy-policy and mailto links handed to the OS) |
| `require()` | `packages/shell/src/app/test-only.ts` (strips test-only code from store bundles) |
| raw `Pressable` | `packages/shell/src/ui/**` |
| raw `Image` | `packages/shell/src/ui/icons/icon.tsx` |
| vendor SDK imports | `ADAPTERS` (one adapter per port) |
| `react-intl` | `packages/shell/src/i18n/**` |
| typed-array mutation (`no-param-reassign` props) | `apps/*/src/sim/**/*.ts`, `packages/game-kit/src/geom/spatial-hash.ts` |
| `export default` | `apps/*/app.config.ts`, `packages/shell/plugins/**/*.ts`, `__mocks__/**`, JS config files |

If the file that owns such an API is named differently, change the glob (with a `Gate-Change:` trailer), not the rule.

## Adding an exception, step by step

Exceptions are rare; most lint errors are fixed in the code (see `references/forbidden-patterns.md`). When a third-party constraint truly needs one:

1. Confirm the need: the error comes from a tool or library contract, not from code that could be written another way.
2. Add a `files`-scoped block in block 5c, naming the exact file, with a comment that states the reason:

   ```js
   // Hypothetical example: a test-build perf sampler that must read performance.now.
   {
     files: ['packages/shell/src/app/perf/memory-sampler.ts'],
     rules: { 'no-restricted-properties': ['error', ...PERF_PROPERTIES] },
   },
   ```

   Prefer extending an existing file list (here `PERF_CLOCK_FILES`) over a new block when one fits. An exception that switches a rule `'off'` goes beyond the baseline's allowed count and fails `eslint-rule-off`: that is a baseline change, so stop and ask the owner.

3. When the rule takes a list (`no-restricted-imports`, `no-restricted-syntax`, `no-restricted-properties`), rebuild it from the shared lists minus the one exempted item. Never write a fresh short list.
4. Run `npx eslint --print-config <file>` for the exempted file and for a neighbour, and check the exemption applies only to the named file.
5. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-configs.mjs .` The baseline allows a fixed number of `'off'` entries for safety and limit rules; an extra one fails `eslint-rule-off`. Changing a limit or the baseline is an owner decision: stop and ask.
6. When `packages/tooling/src/quality/check-quality-gates.ts` exists, run it: the guardrail compares the resolved ESLint config of four probe files (and the tsconfigs, Jest thresholds, scripts and hooks) with `quality-gates.json`. It must still print that every resolved config matches; never edit `quality-gates.json` to make it pass (the quality-gates skill owns it).
7. Commit with a `Gate-Change: <why>` trailer (the config is a gated file).

Editing `eslint.config.mjs`, `.prettierrc.json` or a `tsconfig*.json` at the root or under `apps/` or `packages/` shows the owner a permission prompt (they are `ask` paths in `.claude/settings.json`; the tsconfig templates inside `skills/` do not prompt). That is expected: say in one plain sentence what the change is and why.

Never reword a message of `RESTRICTED_PROPERTIES`: the guardrail compares the `no-restricted-properties` entries, messages included, verbatim (`Use the seeded RNG from @e07/game-kit.`, `Inject ClockPort (spec S15 set-date).`, `Use the frame timestamp or ClockPort.`, `Read direction from DirectionContext.`). `check-configs.mjs` fails on a changed one (`guardrail-message-*`).

## Codes that appear in lint messages

The messages cite the product spec so the fix is obvious:

| Code | Meaning |
|---|---|
| N2 | no server of our own (no purchase server) |
| N3 | our code makes no network requests (ads and store SDKs aside) |
| N5 | one Shell for every game; the Shell never imports a game |
| N9 | icons are code-drawn |
| N11 | layouts mirror in RTL: start/end, never left/right |
| N12 | every user-facing string is translatable (from `t()`) |
| 8.11 | every tappable element declares a role and a label |
| S12 | the Premium screen; S14 the Shell dialogs; S15 the debug menu (set-date) |
| Determinism | Hermes uses the platform libm and Jest runs V8, so transcendental math differs across devices; replays and daily seeds must match |

## Prettier

- Prettier 3.9 is the only formatter (`npm run format`); never format by hand and never with an ESLint formatting plugin (`eslint-plugin-prettier` is banned; `check-configs.mjs` rule `eslint-forbidden-import`).
- It runs as its own check (`npm run format:check`); `eslint-config-prettier` only turns off conflicting ESLint rules.
- `templates/.prettierrc.json`: `printWidth` 100, `singleQuote`, `trailingComma` all, `bracketSpacing`, `arrowParens` always, `endOfLine` lf.
- `templates/.prettierignore` lists the lockfile, generated folders, snapshots, e2e baselines, `skills/` and `.claude/`, then the placeholder `__PRE_EXISTING__`: replace it with one line per pre-existing top-level entry (`handbook/`, `research/`, `README.md`, ...) or delete it when there is none. Without those lines `format:check` fails on day one (hand-written docs and design exports are not Prettier-formatted) and `npm run format` rewrites the owner's files. `check-configs.mjs` reports a missing required line or a leftover placeholder (`prettier-ignore`) and an unignored pre-existing entry (`ignore-pre-existing`).
- The Claude Code PostToolUse hook formats and lints every edited file, so formatting and import order never need thought.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "file not found in any of the provided project(s)" | the file belongs to no tsconfig program | add its folder to the right world's `include` (`references/tsconfig-set.md`) |
| a `no-restricted-imports` ban stops working in one folder | a later block wrote a fresh list | rebuild the block from `RUNTIME_PATHS` / `restrictedImports()` |
| `check-file/filename-blocklist` crashes with "invalid pattern" | a free-text suggestion | the suggestion must be a glob (`**/[a-z]*-[a-z]*.ts`) |
| lint of 26 apps slows past about 2 minutes | one TypeScript program per workspace | lint workspaces in parallel; never weaken rules |
| `no-misused-promises` accepts `onPress={async () => ...}` | RN's Strict API types `onPress` as returning `unknown` | the `asyncHandler` selector catches it; keep handlers synchronous |
| ESLint lints a `.mjs` tool in a pre-existing research folder; `format:check` fails on `.md` or `.html` files outside the monorepo | pre-existing top-level folders are not ignored | add them to `PRE_EXISTING` and `.prettierignore` (`ignore-pre-existing`) |
| the guardrail reports `no-restricted-properties` differs | a `RESTRICTED_PROPERTIES` message or entry changed | restore the exact entry from `templates/eslint.config.mjs` |
