# The naming rules, with reasons and examples

All eighteen naming rules of the Pocket Arcade monorepo, why each exists, what enforces it, and a good/bad table for every kind of name. Read this first when creating or renaming anything; the other references go deeper per area.

## Contents

- Why names matter here
- The rules
- Good and bad, by kind of name

## Why names matter here

Names are the agent's search index. Claude Code finds code by `grep` and by path, so every name must be predictable from the thing it names, and the thing must be findable from its name. The scheme follows three sources:

- the Expo SDK 57 default template, which uses kebab-case files (`themed-text.tsx`, `use-color-scheme.ts`);
- the Google TypeScript style guide (UpperCamelCase types, lowerCamelCase values, CONSTANT_CASE constants, no `I` prefix, acronyms as words);
- the React docs (components are capitalised, hooks start with `use`, handlers are `handleX`, callback props are `onX`).

Where the repo adds its own convention (kebab-case `kind` values, testIDs, i18n keys, git trailers), the rule says why. The canonical names (npm scripts, ports, adapters, `GameModule`, engine functions, env vars) are fixed project decisions: never rename them.

## The rules

1. **Name every file and folder in kebab-case**, lowercase ASCII, words joined by `-` (`counter-button.tsx`, `use-save-game.ts`, `apply-move.ts`). Middle extensions (`.test`, `.golden.test`, `.sim.test`, `.perf.test`, `.d`, `.config`) are allowed. Why: one convention for the whole repo, matching the Expo template; macOS's case-insensitive file system makes case-only renames unreliable. Enforced by: `check-file/filename-naming-convention`, `check-file/folder-naming-convention`, `check-file-names.mjs` (`file-kebab`, `folder-kebab`).
2. **Name a module's main export after its file:** `counter-button.tsx` exports `CounterButton`, `use-save-game.ts` exports `useSaveGame`, `admob-ads-adapter.ts` exports `createAdmobAdsAdapter`. Why: the file name alone tells the agent what to import and where the symbol lives. Enforced by: `check-file-names.mjs` (`export-name`, `port-file`).
3. **Never create `utils.ts`, `helpers.ts`, `misc.ts`, `common.ts`, `shared.ts`, `stuff.ts` or barrel `index.ts` files.** The only `index.ts` files are `apps/<game-id>/index.ts` (the 3-line app entry) and `apps/<game-id>/src/index.ts` (exports the `GameModule`). Why: grab-bag files grow without limit and barrels create import cycles. Enforced by: `check-file/filename-blocklist`, `grab-bag-file`, `barrel-index`.
4. **Values are camelCase, components and types PascalCase, module constants UPPER_CASE.** A module-level constant is UPPER_CASE when it holds fixed data (`MAX_UNDO_DEPTH`, `STEP_MS`, `THEME_PREFERENCES`); objects built by a function call stay camelCase (`styles`, `rootStack`, `useSettingsStore`). Why: Google TS style. Enforced by: `@typescript-eslint/naming-convention`, `constant-name`.
5. **Treat acronyms as words:** `loadHttpUrl`, `SqlDriver`, `isRtl`, `AdmobAdsAdapter`, not `loadHTTPURL` or `isRTL`. The only exceptions are external API names such as `I18nManager.isRTL` or the `testID` prop. Why: word boundaries stay visible and PascalCase checks stay predictable. Enforced by: `acronym-case`.
6. **Prefix every boolean variable and boolean parameter** with `is`, `has`, `can`, `should`, `did`, `will` or `was` (`isPremium`, `hasHint`); UPPER_CASE boolean constants use `IS_`, `HAS_`... (`IS_STORE_BUILD`). This includes destructured booleans: rename them while destructuring (`const { granted: isGranted } = permission`, `({ disabled: isDisabled }: ButtonProps)`). Why: a boolean reads as a question at the call site. Enforced by: `@typescript-eslint/naming-convention` (variables, parameters and destructured names), `boolean-name`.
7. **Declare types with `type`, never `interface`** (except declaration merging in `*.d.ts`), never with an `I` prefix, and never as `enum`. Replace an enum with an `as const` array plus a union: `const GAME_MODES = ['levels', 'daily', 'endless'] as const; type GameMode = (typeof GAME_MODES)[number];` (`templates/string-union.ts`). Why: `erasableSyntaxOnly` rejects enums; unions work with `switch-exhaustiveness-check`. Enforced by: `consistent-type-definitions`, the `TSEnumDeclaration` ban, `tsc`, `type-name`.
8. **Name type parameters `T` or `T` + PascalCase word** (`TState`, `TMove`, `TEvent`). Enforced by: naming-convention `typeParameter` regex `^(T|T[A-Z][A-Za-z]+)$`.
9. **Name React parts the React way:** components PascalCase in their own file; props type `<Component>Props`; hooks `useX` in `use-x.ts`; event handlers `handleX` (`handlePress`); callback props `onX` (`onPress`); screens `<Name>Screen` in `<name>-screen.tsx`; route names PascalCase (`Home`, `SettingsLanguage`). Why: React's documented conventions; the React Compiler and `react-hooks` lint rules rely on the `use` prefix. Enforced by: `export-name`, `type-name`, `handler-name`.
10. **Discriminate data unions with `kind` and reducer actions with `type`; their values are kebab-case string literals.** Moves are imperative (`'place-block'`), events are past tense (`'column-cleared'`), actions are imperative (`'apply-move'`). Why: one grep (`kind: 'column-cleared'`) finds every producer and consumer; kebab values are stable in saves and replays. Enforced by: `no-restricted-syntax` selectors `kindValue` and `kindTypeValue`, `kind-value`.
11. **Use exactly the canonical names for ports, adapters and fakes:** port types `AdsPort`, `PurchasePort`, `SaveStore` (+ `SqlDriver`), `ClockPort`, `ConnectivityPort`, `AudioPort`, `HapticsPort`, `ConsentPort`, `ErrorLogPort`; adapter files `<vendor>-<port>-adapter.ts`; fakes `fake-<port>.ts`. Why: the names are binding project decisions and the ESLint adapter exemption matches these file-name patterns. Enforced by: `export-name`, `port-file`, `fake-file`.
12. **Give every tappable or asserted element a testID `<screen>.<element>`**, all segments kebab-case, at least two segments (`home.play-button`, `levels.level-tile.12`). Why: Maestro flows run unchanged in four languages because they select by id, never by text. Enforced by: the `testIdFormat` selector for literal testIDs, `testid-format`, `testid-index`, `maestro-selector`.
13. **Write i18n keys as semantic, dot-separated, kebab-case paths** of 2 to 5 segments: `<area>.<element>[.<variant>]` (`home.play-button.continue`). Game-module keys start with the game id (`line-siege.lose.broke-through`); Shell keys never start with any game id. Why: keys describe meaning, so a text change never renames a key; the prefix makes merged Shell and game catalogs collision-free. Enforced by: `npm run i18n:verify` (the catalog linter), `i18n-key`, `i18n-key-built`, `i18n-placeholder`.
14. **Name tests after the unit, colocated:** `<unit>.test.ts(x)` next to the unit; data goldens `*.golden.test.ts`; slow bot runs `*.sim.test.ts`; perf tests `*.perf.test.ts`; integration tests under root `test/integration/`. `describe('<exported name>')` → `describe('when …')` → `it('<third-person verb> …')`. Why: Jest projects select by suffix; `jest/valid-title` enforces the verb. Enforced by: `jest/valid-title` with `^(can|[a-z]+s)\b`, `test-file`, `test-title`.
15. **Write commit headers in Conventional Commits form** `<type>(<scope>): <subject>`, header at most 72 characters, no trailing period; the scope is a workspace folder name (`line-siege`, `shell`, `game-kit`, `tooling`) or `repo`, `deps`, `docs`, `ci`, `skills`. Enforced by: the lefthook `commit-msg` hook (the git-commits-and-reporting skill owns the details).
16. **Add a `Gate-Change: <reason>` trailer** to any commit that changes a quality gate, a network baseline, a golden snapshot, a screenshot baseline or a frozen save fixture. Why: the owner finds every gate change with `git log --grep '^Gate-Change:'`.
17. **Tag releases per app:** `<game-id>/v<MAJOR>.<MINOR>.<PATCH>` when the owner says "ship", and `<game-id>/v<X.Y.Z>+<build>` for every uploaded build (`line-siege/v1.0.0`, `line-siege/v1.0.0+8`). Never move or reuse a tag. Why: one repo holds ~26 apps; the prefix keeps each version line separate.
18. **Start every `.ts`/`.tsx` file with a comment holding its repo-relative path** (`// packages/shell/src/ui/app-text.tsx`). Why: snippets, diffs and tool output always show where code lives. Enforced by: `path-header`.

## Good and bad, by kind of name

| Thing | Good | Bad | Enforced by |
|---|---|---|---|
| Source file | `apply-move.ts`, `level-tile.tsx` | `applyMove.ts`, `LevelTile.tsx`, `apply_move.ts` | check-file, `file-kebab` |
| Folder | `how-to-play/`, `game-host/` | `HowToPlay/`, `__tests__/`, `game_host/` | check-file, `folder-kebab` |
| Test file | `apply-move.test.ts`, `daily-seed.golden.test.ts`, `balance.sim.test.ts` | `apply-move.spec.ts`, `__tests__/apply-move.ts` | Jest `testMatch`, `test-file` |
| Grab-bag file | `format-duration.ts`, `clamp-to-board.ts` | `utils.ts`, `helpers.ts`, `common.ts` | check-file blocklist |
| Barrel | none (import the file) | `packages/shell/src/ui/index.ts` | check-file blocklist |
| Component | `export function LevelTile(…)` in `level-tile.tsx` | `export default function (…)`, `levelTile` | naming-convention, `export-name` |
| Props type | `type LevelTileProps = { … }` | `interface ILevelTileProps`, `type Props` | consistent-type-definitions, `type-name` |
| Hook | `useSaveGame` in `use-save-game.ts` | `saveGameHook`, `useSaveGame` in `save.ts` | react-hooks, `export-name` |
| Handler / callback prop | `onPress={handlePress}` | `onPress={onClick}`, `onPress={press}` | `handler-name` |
| Boolean | `isPremium`, `hasHint`, `IS_STORE_BUILD` | `premium`, `hint`, `loading`, `rtl` | naming-convention, `boolean-name` |
| Boolean parameter | `(isMirrored: boolean)` | `(mirrored: boolean)` | naming-convention, `boolean-name` |
| Constant data | `MAX_UNDO_DEPTH = 200`, `THEME_PREFERENCES = [...] as const` | `maxUndoDepth` at module level, `kMaxUndo` | `constant-name` |
| Enum replacement | `type GameMode = (typeof GAME_MODES)[number]` | `enum GameMode { Levels }` | `TSEnumDeclaration`, `erasableSyntaxOnly` |
| Type parameter | `TState`, `TMove`, `T` | `S`, `StateType`, `TS` | naming-convention |
| Acronym | `SqlDriver`, `isRtl`, `loadHttpUrl` | `SQLDriver`, `isRTL`, `loadHTTPURL` | `acronym-case` |
| Store | `useSettingsStore` in `settings-store.ts` | `settingsStore`, `useStore` in `store.ts` | `export-name` |
| Reducer | `settingsReducer` in `settings-reducer.ts` | `reducer`, `settingsReduce` | `export-name` |
| Action | `{ type: 'set-theme', theme }` | `{ type: 'SET_THEME' }`, `{ type: 'setTheme' }` | `kindValue`, `kind-value` |
| Move | `{ kind: 'place-block', trayIndex, col, row }` | `{ type: 'PlaceBlock' }`, `{ move: 'place' }` | `kindValue`, `kind-value` |
| Event | `{ kind: 'column-cleared', col }` | `{ kind: 'clear-column' }` (imperative), `{ kind: 'COLUMN_CLEARED' }` | `kind-value`, review |
| Port type | `AdsPort`, `SaveStore`, `ErrorLogPort` | `IAds`, `AdsService`, `AdsInterface` | canonical names |
| Adapter file | `admob-ads-adapter.ts`, `expo-iap-purchase-adapter.ts`, `sqlite-save-store.ts` | `ads.ts`, `AdMobAdapter.ts`, `ads-admob.ts` | ESLint `ADAPTERS` glob, `export-name` |
| Fake | `fake-ads.ts` → `createFakeAds()` | `ads.mock.ts`, `mock-ads.ts` | `fake-file` |
| testID | `home.play-button`, `levels.level-tile.12` | `playButton`, `Home.Play`, `home_play` | `testIdFormat`, `testid-format` |
| i18n key | `home.play-button.continue`, `line-siege.lose.broke-through` | `continueLevel12`, `Home.Play`, `home.play.Continue` | `i18n:verify`, `i18n-key` |
| Placeholder | `{level, number}`, `{movesCount, plural, …}`, `{packName}` | `{0}`, `{best-score}`, `{LEVEL}`, plain `{level}` for a number | `i18n:verify`, `i18n-placeholder` |
| Env var | `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` | `appVariant`, `EXPO_APP_VARIANT` | `env-var`, `app-env.d.ts` |
| Commit | `feat(line-siege): add endless mode` | `Added endless mode.`, `feat: stuff`, `feat(ui): x` | commit-msg hook |
| Release / build tag | `line-siege/v1.2.0`, `line-siege/v1.2.0+14` | `v1.2.0`, `line-siege-1.2.0`, `line-siege/1.2` | `release:ios` |
