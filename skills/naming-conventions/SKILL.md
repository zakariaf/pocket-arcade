---
name: naming-conventions
description: Names Pocket Arcade files, folders, exports, types, hooks, handlers, booleans, kind values, testIDs, i18n keys, packages, scripts and env vars. Use when creating or renaming anything, or on a naming lint error. Not for limits (typescript-and-lint-rules) or placement (architecture-and-boundaries).
---

# Naming conventions

One naming scheme for everything in the Pocket Arcade monorepo, so every name is predictable from the thing it names and every thing is findable from its name. Claude finds code by `grep` and by path; names are the search index. This skill holds the rules, the canonical names that are never changed, and two checkers that prove the repo follows them.

## Rules that must hold

1. **Files and folders are kebab-case, and line 1 names the path.** `apply-move.ts`, `level-tile.tsx`, `how-to-play/`; middle extensions `.test`, `.golden.test`, `.sim.test`, `.perf.test`, `.d`, `.config` are fine. Line 1 of every `.ts`/`.tsx` is `// <repo-relative path>`. Why: one convention matching the Expo template; macOS ignores case but Linux CI does not; the header shows where any snippet lives.
2. **The main export is named after its file.** `level-tile.tsx` → `LevelTile`, `use-save-game.ts` → `useSaveGame`, `home-screen.tsx` → `HomeScreen`, `admob-ads-adapter.ts` → `createAdmobAdsAdapter`, `fake-ads.ts` → `createFakeAds`, `ads-port.ts` → `AdsPort`, `stores/premium-store.ts` → `usePremiumStore`, `premium-reducer.ts` → `premiumReducer`, `plugins/with-x.ts` → `withX`. Why: the file name alone tells what to import and where the symbol lives.
3. **No grab-bag or barrel files.** No `utils.ts`, `helpers.ts`, `misc.ts`, `common.ts`, `shared.ts`, `stuff.ts`; the only `index.ts` files are `apps/<game-id>/index.ts` and `apps/<game-id>/src/index.ts`. Why: grab-bags grow without limit and barrels create import cycles.
4. **Case by kind.** Values and functions camelCase; components and types PascalCase; module-level fixed data (a literal, a regex, an `as const` table) UPPER_CASE; objects built by a call stay camelCase (`styles`, `rootStack`). Acronyms are words (`SqlDriver`, `isRtl`), and no leading or trailing underscores except unused parameters. Why: Google TypeScript style, and predictable word boundaries.
5. **Booleans read as questions.** Every boolean variable and parameter starts with `is`, `has`, `can`, `should`, `did`, `will` or `was` (`IS_`, `HAS_`… for constants); rename destructured booleans (`{ disabled: isDisabled }`). Why: `if (isLocked)` reads as a question at the call site.
6. **Types are `type`, never `interface` (outside `*.d.ts` merging), never `I`-prefixed, never `enum`.** A closed set is an `as const` array plus a derived union. Props are `<Component>Props`, state `<Domain>State`, actions `<Domain>Action`, errors `<Operation>Error`, options `<Function>Options`, type parameters `T` or `TName`. Why: erasable syntax, exhaustive switches, and names that say whose they are.
7. **React names the React way.** Handlers inside a component are `handleX`, callback props `onX`, hooks `useX` in `use-x.ts` (one per file), screens `<Name>Screen` in `<name>-screen.tsx`, route names PascalCase. Why: the React Compiler and `react-hooks` rules rely on `use`; readers rely on the rest.
8. **`kind` and `type` values are kebab-case with a grammar.** Moves are imperative (`'place-block'`), events past tense (`'column-cleared'`), errors a noun phrase (`'newer-schema'`), reducer actions imperative (`'set-theme'`). They are saved in run logs and replays: renaming one needs a save migration. Why: one grep finds every producer and consumer, and saves stay readable forever.
9. **Canonical names are never renamed.** Ports `AdsPort`, `PurchasePort`, `SaveStore` (+ `SqlDriver`), `ClockPort`, `ConnectivityPort`, `AudioPort`, `HapticsPort`, `ConsentPort`, `ErrorLogPort`; adapters `<vendor>-<port>-adapter.ts`; fakes `fake-<port>.ts`; `GameModule`; engine functions `create`, `listMoves`, `applyMove`, `outcome`, `intentToMove`, `buildTimeline`, `draw`; the npm scripts; `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT`, `ADS_MODE`. Why: they are binding project decisions and the lint exemptions match these names.
10. **testIDs are `<screen>.<element>[.<key>]`, kebab-case, and flows select only by id.** `home.play-button`, `levels.level-tile.12`; repeated items append a stable data key, never a list index; interactive elements end in their role (`-button`, `-row`, `-tile`). Why: Maestro flows run unchanged in four languages.
11. **i18n keys are semantic literals.** 2-5 dot-separated kebab segments (`home.play-button.continue`); game keys start with the game id, Shell keys never do; keys are literals at the call site or from a typed table, never built; placeholders are camelCase and typed (`{level, number}`, `{movesCount, plural, …}`, free text `{…Name}`/`{…Text}`). Why: a wording change never renames a key, merged catalogs never collide, and tools can check what they can see.
12. **Tests and flows are named after what they cover.** `<unit>.test.ts(x)` next to the unit (`.golden.test.ts`, `.sim.test.ts`, `.perf.test.ts`, integration in root `test/integration/<area>/`); `describe('<exported name>')` → `describe('when …')` → `it('<third-person verb> …')`; `it`, never `test`; Maestro flows are `e2e/flows/<area>/<nn>-<name>.yaml` (Shell `01`-`09`, a game's own from `10`), sub-flows `packages/shell/e2e/subflows/<name>.yaml`. Why: Jest projects select by suffix, titles read as specifications, and the E2E runner lists `flows/<area>/*.yaml`.
13. **Ids outside the code follow one shape.** Packages `@<scope>/<folder>` with one scope; game id = app folder = `GameConfig.id` = slug = commit scope; bundle id `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`; premium id `<bundleId>.premium`; env vars UPPER_SNAKE_CASE, runtime ones `EXPO_PUBLIC_*` read with dot access; npm scripts `<verb>` or `<area>:<verb>`; tags `<game-id>/vX.Y.Z` and `<game-id>/vX.Y.Z+<build>`, never moved. Why: one repo holds ~26 apps, and ids are stable forever.

## Workflow

1. Name what you are about to create before writing it. Find the kind of name in the table below and read that reference section; for anything new, start with [references/naming-rules.md](references/naming-rules.md) (the rules and a good/bad table for every kind).
2. For a closed set of values (modes, themes, variants), copy [templates/string-union.ts](templates/string-union.ts) and fill every `__PLACEHOLDER__`. For a new game's engine types (`apps/<game-id>/src/rules/<game-id>-types.ts`, written with the game-rules-engine templates), name them `<Game>State`, `<Game>Move`, `<Game>Event`, `<Game>Result` and pick every kind with the grammar in [references/kinds-testids-and-keys.md](references/kinds-testids-and-keys.md), imitating [examples/line-siege-types.ts](examples/line-siege-types.ts). Let Prettier format the filled file.
3. Imitate the examples: [examples/level-tile.tsx](examples/level-tile.tsx) (component, props, handler, testID), [examples/settings-reducer.ts](examples/settings-reducer.ts) and its test (state, actions, reducer, test titles), [examples/line-siege-types.ts](examples/line-siege-types.ts) (kinds), [examples/01-first-launch.yaml](examples/01-first-launch.yaml) (flow selectors).
4. Renaming: change the file, its path header, its main export and every import in one commit. A saved name (a `kind` value, a counter or sound id, a catalog key) also needs a save migration or catalog update, and a `Gate-Change:` trailer when a golden or fixture changes. A canonical name (rule 9): stop and ask the owner.
5. Check (validation loop): when `node_modules` exist, `npm run lint` (naming-convention, check-file, the testID and kind selectors) and, after catalog changes, `npm run i18n:verify`. Always: `node ${CLAUDE_SKILL_DIR}/scripts/check-file-names.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-code-names.mjs .`. Fix every `FAIL` line (file, rule, fix) and rerun until both print `RESULT: PASS`.

| Naming… | Read |
|---|---|
| a file, folder, test file, fake, flow, catalog, level table or plugin | [references/files-and-folders.md](references/files-and-folders.md) |
| a variable, constant, type, component, hook, handler, prop, store, reducer or action | [references/code-identifiers.md](references/code-identifiers.md) |
| a move, event, error, action value, testID, Maestro selector, i18n key or placeholder | [references/kinds-testids-and-keys.md](references/kinds-testids-and-keys.md) |
| a package, game id, bundle or product id, npm script, env variable, commit, branch or tag | [references/packages-scripts-env-and-tags.md](references/packages-scripts-env-and-tags.md) |

## Definition of done

- [ ] `npm run lint` passes (or `npx eslint . --max-warnings 0`), including naming-convention, check-file and the testID/kind selectors.
- [ ] After a catalog change, `npm run i18n:verify` passes and every new key exists in all four catalogs.
- [ ] Every new file is kebab-case, its main export is named after it, and line 1 is `// <repo-relative path>`.
- [ ] No new `utils`/`helpers`/`common`/`index` files (except the two app entry files).
- [ ] New ports, adapters and fakes use the canonical names and the `<vendor>-<port>-adapter.ts` / `fake-<port>.ts` patterns.
- [ ] New moves are imperative, new events past tense, all `kind`/`type` values kebab-case; renamed saved names have a migration.
- [ ] Every tappable or asserted element has a `<screen>.<element>` testID, and flows select by `id:` only.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-code-names.mjs .` prints `RESULT: PASS` (testIDs, kinds, keys, placeholders, env, titles, identifiers, flows).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-file-names.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Naming after the implementation instead of the job.** `sqlite-helpers.ts`, `utils.ts`: name the file after what it does (`read-slot.ts`), one job per file.
- **A second name for a canonical thing.** `AdsService`, `IAds`, `step()` instead of `applyMove`, `isOver` instead of `outcome`: the canonical names are what every skill, lint exemption and test expects.
- **English text in keys.** `home.continue-level` breaks when the wording changes; name the meaning (`home.play-button.continue`).
- **Building keys or testIDs from strings.** `` t(`date.month-short.${month}`) `` and `` testID={`row-${index}`} `` hide names from the tools; use a typed table of literal keys and a stable data key.
- **Imperative events or past-tense moves.** `{ kind: 'clear-column' }` as an event reads as a command; events say what happened (`'column-cleared'`).
- **Renaming a saved `kind` "for consistency".** Old saves and replays still hold the old value; migrate them or keep the name.
- **Selecting by text in a flow.** `tapOn: 'Play'` fails in German, Persian and Kurdish; select by id. Only an OS dialog without a testID may use text: the `runFlow: { when: { visible: 'Open' }, commands: [tapOn: 'Open'] }` guard, or a line marked `# system dialog`.
- **Silencing the naming rule instead of renaming.** Inline disables are switched off; the rename is always the fix.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/naming-rules.md](references/naming-rules.md) | The 18 rules with reasons and a good/bad table for every kind of name | Workflow step 1 |
| [references/files-and-folders.md](references/files-and-folders.md) | File patterns by kind, ports/adapters/fakes, tests, catalogs, flows, plugins, tool-owned names, the path header | Naming a file or folder |
| [references/code-identifiers.md](references/code-identifiers.md) | Identifiers, types, React parts, stores and actions, and the enforcing ESLint naming config | Naming inside a file; a naming-convention error |
| [references/kinds-testids-and-keys.md](references/kinds-testids-and-keys.md) | The kind grammar, testIDs, Maestro selectors, i18n keys and placeholders | Adding a move, event, action, testID or key |
| [references/packages-scripts-env-and-tags.md](references/packages-scripts-env-and-tags.md) | Packages, game/bundle/product ids, npm scripts, env variables, commit and tag names | Adding a workspace, game, script, variable or release |
| [templates/string-union.ts](templates/string-union.ts) | `as const` values + derived union + guard (the enum replacement) | Workflow step 2 |
| [examples/level-tile.tsx](examples/level-tile.tsx) | Component, props, boolean prop, handler, callback prop, testID with a data key | Workflow step 3 |
| [examples/settings-reducer.ts](examples/settings-reducer.ts) | State, action union, default, reducer and an `as const` table | Workflow step 3 |
| [examples/settings-reducer.test.ts](examples/settings-reducer.test.ts) | describe/when/it titles with third-person verbs | Workflow step 3 |
| [examples/line-siege-types.ts](examples/line-siege-types.ts) | Line Siege v1's real types (synced from the library, do not edit here): game-prefixed state, move and event types with kebab kinds | Workflow steps 2 and 3 |
| [examples/01-first-launch.yaml](examples/01-first-launch.yaml) | A Shell journey (`packages/shell/e2e/flows/smoke/`) that selects only by id | Workflow step 3 (E2E) |
| `scripts/check-file-names.mjs` | Checks file/folder names, headers, export names, test/fake/flow/catalog/level/plugin/fixture patterns, package names, game ids, script names | Workflow step 5 |
| `scripts/check-code-names.mjs` | Checks testIDs, kind values, i18n keys and placeholders, env vars, test titles, type/boolean/handler/constant/acronym names, flow selectors | Workflow step 5 |
| `scripts/lib/names.mjs` | Case helpers and the naming data loader | Only when changing a checker |
| `scripts/lib/source-scan.mjs` | Dependency-free lexer for comments, strings, imports and functions (synced from the library; do not edit here) | Only when changing a checker |
| `scripts/lib/workspaces.mjs` | Reads the workspace packages (synced from the library) | Only when changing a checker |
| `scripts/selftest.mjs` | Proves both checkers pass good fixtures and catch every planted bug | After changing a checker or the naming data |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/naming-rules.json` | The grammars (testID, key, bundle id, script, env), prefixes and the canonical names | When a canonical name or grammar changes (owner decision) |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test | When adding a rule to a checker |

## Related skills

- `typescript-and-lint-rules` - the full ESLint and tsconfig set, limits and forbidden patterns.
- `architecture-and-boundaries` - which folder and workspace a file belongs in.
- `i18n-strings-and-catalogs` - catalog format, ICU messages, the catalog linter and translations.
- `e2e-maestro` - writing the flows that use these testIDs.
- `git-commits-and-reporting` - commit bodies, trailers and owner reports.
- `game-rules-engine` - the engine functions and the moves and events a game defines.
