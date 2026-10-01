# 03 · Naming

> **What this doc decides.** One naming scheme for everything Claude Code creates in this repo: files, folders, identifiers, types, React parts, stores and actions, ports and adapters, game-engine moves and events, testIDs, i18n keys, packages, npm scripts, env vars, commits and release tags.
> Most rules are enforced by ESLint (`eslint-plugin-check-file`, `@typescript-eslint/naming-convention`, `no-restricted-syntax`) or by the lefthook `commit-msg` hook, so a wrong name fails `npm run check:fast` before a human ever sees it.
> The complete ESLint file lives in [04-code-style-and-limits.md](04-code-style-and-limits.md); this doc shows the naming parts of it.
> **Related docs:** [04-code-style-and-limits.md](04-code-style-and-limits.md) (the enforcing ESLint config), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (i18n key grammar and catalog linter), [07-testing-and-tdd.md](07-testing-and-tdd.md) (test names and testIDs in flows), [14-ios-build-and-release.md](14-ios-build-and-release.md) (release tags), [16-quality-gates-hooks-ci.md](16-quality-gates-hooks-ci.md) (the commit-msg hook). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

## Intro

Names are the agent's search index. Claude Code finds code by `grep` and by path, so every name must be predictable from the thing it names, and the thing must be findable from its name. The scheme below follows three sources:

- the Expo SDK 57 default template, which uses kebab-case files (`themed-text.tsx`, `use-color-scheme.ts`);
- the Google TypeScript style guide (UpperCamelCase types, lowerCamelCase values, CONSTANT_CASE constants, no `I` prefix, acronyms as words);
- the React docs (components are capitalised, hooks start with `use`, handlers are `handleX`, callback props are `onX`).

Where this repo adds its own convention (kebab-case `kind` values, testIDs, i18n keys, git trailers), the rule says why.

Canonical names from FINAL-DECISIONS section F (npm scripts, ports, adapters, `GameModule`, engine functions, env vars) are reproduced here unchanged. Never rename them.

## Rules

1. **Name every file and folder in kebab-case**, lowercase ASCII, words joined by `-` (`counter-button.tsx`, `use-save-game.ts`, `apply-move.ts`). Middle extensions (`.test`, `.golden.test`, `.sim.test`, `.d`) are allowed.
   *Why:* one convention for the whole repo, matching the Expo template; macOS's case-insensitive file system makes case-only renames unreliable. *Enforced by:* `check-file/filename-naming-convention` and `check-file/folder-naming-convention`. *Source:* [Expo default template](https://github.com/expo/expo/tree/main/templates/expo-template-default).
2. **Name a module's main export after its file:** `counter-button.tsx` exports `CounterButton`, `use-save-game.ts` exports `useSaveGame`, `admob-ads-adapter.ts` exports `createAdmobAdsAdapter`.
   *Why:* the file name alone tells the agent what to import and where the symbol lives. *Enforced by:* review and the checklist grep.
3. **Never create `utils.ts`, `helpers.ts`, `misc.ts`, `common.ts`, `shared.ts` or barrel `index.ts` files.** The only `index.ts` files are `apps/<game-id>/index.ts` (the 3-line app entry) and `apps/<game-id>/src/index.ts` (exports the `GameModule`).
   *Why:* grab-bag files grow without limit and barrels create import cycles. *Enforced by:* `check-file/filename-blocklist`.
4. **Values are camelCase, components and types PascalCase, module constants UPPER_CASE.** A module-level constant is UPPER_CASE when it holds fixed data (`MAX_UNDO_DEPTH`, `STEP_MS`, `THEME_PREFERENCES`); objects built by a function call stay camelCase (`styles`, `rootStack`, `useSettingsStore`).
   *Why:* Google TS style. *Enforced by:* `@typescript-eslint/naming-convention`. *Source:* [Google TS style guide, naming](https://google.github.io/styleguide/tsguide.html#naming).
5. **Treat acronyms as words:** `loadHttpUrl`, `SqlDriver`, `isRtl`, `AdmobAdsAdapter`, not `loadHTTPURL` or `isRTL` (the only exception is an external API name such as `I18nManager.isRTL` or the `testID` prop).
   *Why:* word boundaries stay visible and naming-convention's PascalCase check stays predictable. *Source:* Google TS style guide.
6. **Prefix every boolean variable and boolean parameter** with `is`, `has`, `can`, `should`, `did`, `will` or `was` (`isPremium`, `hasHint`); UPPER_CASE boolean constants use `IS_`, `HAS_`… (`IS_STORE_BUILD`). This includes destructured booleans: rename them while destructuring (`const { granted: isGranted } = permission`, `({ disabled: isDisabled }: ButtonProps)`).
   *Why:* a boolean reads as a question at the call site. *Enforced by:* `@typescript-eslint/naming-convention` (variable and parameter selectors; the boolean selector also applies to destructured names, verified).
7. **Declare types with `type`, never `interface`** (except declaration merging in `*.d.ts`), never with an `I` prefix, and never as `enum`. Replace an enum with an `as const` array plus a union: `const GAME_MODES = ['levels', 'daily', 'endless'] as const; type GameMode = (typeof GAME_MODES)[number];`
   *Why:* `erasableSyntaxOnly` rejects enums; unions work with `switch-exhaustiveness-check`. *Enforced by:* `consistent-type-definitions`, `no-restricted-syntax` (`TSEnumDeclaration`), `tsc`. *Source:* [TS handbook, objects vs enums](https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums).
8. **Name type parameters `T` or `T` + PascalCase word** (`TState`, `TMove`, `TEvent`).
   *Enforced by:* naming-convention `typeParameter` regex `^(T|T[A-Z][A-Za-z]+)$`.
9. **Name React parts the React way:** components PascalCase in their own file; props type `<Component>Props`; hooks `useX` in `use-x.ts`; event handlers `handleX` (`handlePress`); callback props `onX` (`onPress`); screens `<Name>Screen` in `<name>-screen.tsx`; route names PascalCase (`Home`, `SettingsLanguage`).
   *Why:* React's documented conventions; the React Compiler and `react-hooks` lint rules rely on the `use` prefix. *Source:* [React: responding to events](https://react.dev/learn/responding-to-events), [React: hook names](https://react.dev/learn/reusing-logic-with-custom-hooks#hook-names-always-start-with-use).
10. **Discriminate data unions with `kind` and reducer actions with `type`; their values are kebab-case string literals.** Moves are imperative (`'place-block'`), events are past tense (`'column-cleared'`), actions are imperative (`'apply-move'`).
    *Why:* one grep (`kind: 'column-cleared'`) finds every producer and consumer; kebab values are stable in saves and replays. *Enforced by:* `no-restricted-syntax` selectors `kindValue` and `kindTypeValue`.
11. **Use exactly the section-F names for ports, adapters and fakes:** port types `AdsPort`, `PurchasePort`, `SaveStore` (+ `SqlDriver`), `ClockPort`, `ConnectivityPort`, `AudioPort`, `HapticsPort`, `ConsentPort`, `ErrorLogPort`; adapter files `<vendor>-<port>-adapter.ts`; fakes `fake-<port>.ts`.
    *Why:* FINAL-DECISIONS F is binding; the ESLint adapter exemption matches these file-name patterns.
12. **Give every tappable or asserted element a testID `<screen>.<element>`**, all segments kebab-case, at least two segments (`home.play-button`, `levels.level-tile.12`).
    *Why:* Maestro flows run unchanged in four languages because they select by id, never by text. *Enforced by:* `no-restricted-syntax` selector `testIdFormat` for literal testIDs.
13. **Write i18n keys as semantic, dot-separated, kebab-case paths** of 2 to 5 segments: `<area>.<element>[.<variant>]` (`home.play-button.continue`). Game-module keys start with the game id (`line-siege.lose.broke-through`); Shell keys never start with any game id.
    *Why:* keys describe meaning, so a text change never renames a key; the prefix makes merged Shell and game catalogs collision-free. *Enforced by:* `npm run i18n:verify` (catalog linter, docs/10).
14. **Name tests after the unit, colocated:** `<unit>.test.ts(x)` next to the unit; data goldens `*.golden.test.ts`; slow bot runs `*.sim.test.ts`; integration tests under root `test/integration/`. `describe('<exported name>')` → `describe('when …')` → `it('<third-person verb> …')`.
    *Why:* Jest projects select by suffix; `jest/valid-title` enforces the verb. *Enforced by:* `jest/valid-title` with `^(can|[a-z]+s)\b`.
15. **Write commit headers in Conventional Commits form** `<type>(<scope>): <subject>`, header at most 72 characters, no trailing period; scope is a workspace directory name (`line-siege`, `shell`, `game-kit`, `tooling`) or `repo`, `deps`, `docs`, `ci`.
    *Enforced by:* lefthook `commit-msg` → `packages/tooling/src/git/check-commit-message.ts`. *Source:* [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
16. **Add a `Gate-Change: <reason>` trailer** to any commit that changes a quality gate, a network baseline, a golden snapshot, a screenshot baseline or a frozen save fixture (the list is `gatedPaths` in `quality-gates.json`).
    *Why:* the owner can find every gate change with `git log --grep '^Gate-Change:'`. *Enforced by:* the same `commit-msg` hook. *Source:* FINAL D.42; [git interpret-trailers](https://git-scm.com/docs/git-interpret-trailers).
17. **Tag releases per app:** the release tag is `<game-id>/v<MAJOR>.<MINOR>.<PATCH>` (`line-siege/v1.0.0`, set when the owner says "ship"), and every uploaded build also gets `<game-id>/v<X.Y.Z>+<build>` (`line-siege/v1.0.0+8`). `npm run release:ios` creates both (docs/14). Never move or reuse a tag.
    *Why:* one repo holds ~26 apps; the prefix keeps each app's version line separate (FINAL A.8). *Source:* [SemVer 2.0.0](https://semver.org/), [git check-ref-format](https://git-scm.com/docs/git-check-ref-format).
18. **Start every `.ts`/`.tsx` file with a comment holding its repo-relative path** (`// packages/shell/src/ui/app-text.tsx`).
    *Why:* snippets, diffs and tool output always show where code lives. *Enforced by:* the checklist grep below.

## Details

### 1. Examples table

| Thing | Good | Bad | Enforced by |
|---|---|---|---|
| Source file | `apply-move.ts`, `level-tile.tsx` | `applyMove.ts`, `LevelTile.tsx`, `apply_move.ts` | check-file |
| Folder | `how-to-play/`, `game-host/` | `HowToPlay/`, `__tests__/`, `game_host/` | check-file |
| Test file | `apply-move.test.ts`, `daily-seed.golden.test.ts`, `balance.sim.test.ts` | `apply-move.spec.ts`, `__tests__/apply-move.ts` | check-file, Jest `testMatch` |
| Grab-bag file | `format-duration.ts`, `clamp-to-board.ts` | `utils.ts`, `helpers.ts`, `common.ts` | check-file blocklist |
| Barrel | none (import the file) | `packages/shell/src/ui/index.ts` | check-file blocklist |
| Component | `export function LevelTile(…)` in `level-tile.tsx` | `export default function (…)`, `levelTile` | naming-convention, `import/no-default-export` |
| Props type | `type LevelTileProps = { … }` | `interface ILevelTileProps`, `type Props` | naming-convention, consistent-type-definitions |
| Hook | `useSaveGame` in `use-save-game.ts` | `saveGameHook`, `useSaveGame` in `save.ts` | react-hooks, review |
| Handler / callback prop | `onPress={handlePress}` | `onPress={onClick}`, `onPress={press}` | review, `asyncHandler` selector (docs/04) |
| Boolean | `isPremium`, `hasHint`, `IS_STORE_BUILD` | `premium`, `hint`, `loading`, `rtl` | naming-convention |
| Boolean parameter | `(isMirrored: boolean)` | `(mirrored: boolean)` | naming-convention |
| Constant data | `MAX_UNDO_DEPTH = 200`, `THEME_PREFERENCES = [...] as const` | `maxUndoDepth` at module level, `kMaxUndo` | naming-convention |
| Enum replacement | `type GameMode = (typeof GAME_MODES)[number]` | `enum GameMode { Levels }` | `TSEnumDeclaration` ban, `erasableSyntaxOnly` |
| Type parameter | `TState`, `TMove`, `T` | `S`, `StateType`, `TS` | naming-convention |
| Acronym | `SqlDriver`, `isRtl`, `loadHttpUrl` | `SQLDriver`, `isRTL`, `loadHTTPURL` | review |
| Store | `useSettingsStore` in `settings-store.ts` | `settingsStore`, `useStore` in `store.ts` | review |
| Reducer | `settingsReducer` in `settings-reducer.ts` | `reducer`, `settingsReduce` | review |
| Action | `{ type: 'set-theme', theme }` | `{ type: 'SET_THEME' }`, `{ type: 'setTheme' }` | `kindValue` selector |
| Move | `{ kind: 'place-block', column }` | `{ type: 'PlaceBlock' }`, `{ move: 'place' }` | `kindValue` selector |
| Event | `{ kind: 'column-cleared', column }` | `{ kind: 'clear-column' }` (imperative), `{ kind: 'COLUMN_CLEARED' }` | `kindValue` selector, review |
| Port type | `AdsPort`, `SaveStore`, `ErrorLogPort` | `IAds`, `AdsService`, `AdsInterface` | section F |
| Adapter file | `admob-ads-adapter.ts`, `expo-iap-purchase-adapter.ts`, `sqlite-save-store.ts` | `ads.ts`, `AdMobAdapter.ts`, `ads-admob.ts` | section F, ESLint `ADAPTERS` glob |
| Fake | `fake-ads.ts` → `createFakeAds()` | `ads.mock.ts`, `mock-ads.ts` | section F |
| testID | `home.play-button`, `levels.level-tile.12` | `playButton`, `Home.Play`, `home_play` | `testIdFormat` selector |
| i18n key | `home.play-button.continue`, `line-siege.lose.broke-through` | `continueLevel12`, `Home.Play`, `home.play.Continue` | `i18n:verify` |
| Placeholder | `{level, number}`, `{movesCount, plural, …}`, `{packName}` | `{0}`, `{best-score}`, `{LEVEL}`, plain `{level}` for a number | `i18n:verify` |
| Env var | `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` | `appVariant`, `EXPO_APP_VARIANT` | review, `app-env.d.ts` |
| Commit | `feat(line-siege): add endless mode` | `Added endless mode.`, `feat: stuff`, `feat(ui): x` | commit-msg hook |
| Release / build tag | `line-siege/v1.2.0`, `line-siege/v1.2.0+14` | `v1.2.0`, `line-siege-1.2.0`, `line-siege/1.2` | `release:ios` (docs/14) |

### 2. Files and folders

Rule of thumb: the path answers "what is this?" and "who owns it?". The canonical layout (FINAL A.8) fixes the top of every path; below it, names are kebab-case nouns or verb phrases.

| Kind of file | Pattern | Example |
|---|---|---|
| Pure logic module | `<verb>-<noun>.ts` or `<noun>.ts` | `apply-move.ts`, `sfc32.ts`, `board-layout.ts` |
| Component | `<noun>.tsx` | `level-tile.tsx`, `top-bar.tsx` |
| Screen | `screens/<screen>/<screen>-screen.tsx` | `screens/home/home-screen.tsx` |
| Hook | `use-<noun-or-verb>.ts` | `use-board-gestures.ts` |
| Store / reducer / selectors | `<domain>-store.ts`, `<domain>-reducer.ts`, `<domain>-selectors.ts` | `premium-store.ts` |
| Port type | `<port>-port.ts` (or the section-F name kebab-cased) | `ads-port.ts`, `save-store.ts`, `sql-driver.ts` |
| Adapter | `<vendor>-<port>-adapter.ts` | `admob-ads-adapter.ts` |
| Fake | `fake-<port>.ts` | `fake-purchase.ts`, `fake-save-store.ts` |
| Ambient declarations | `<topic>.d.ts` | `app-env.d.ts`, `react-navigation.d.ts` |
| Catalog | `<language>.json` | `src/i18n/ckb.json` |
| Level table | `<pack>.json` | `src/levels/pack-1.json` |
| Maestro flow | `e2e/flows/<area>/<nn>-<name>.yaml` | `e2e/flows/smoke/01-first-launch.yaml` |
| Config plugin | `with-<capability>.ts` | `plugins/with-storekit-test.ts` |
| Tooling script | `<verb>-<noun>.ts` | `check-commit-message.ts`, `audit-licenses.ts` |

Tool-owned names keep the tool's spelling: `package.json`, `app.config.ts`, `eslint.config.mjs`, `jest.config.js`, `babel.config.js`, `__mocks__/<package-name>.ts`, Jest's `__snapshots__/` and `__image_snapshots__/`, `README.md`, `AGENTS.md`, `CLAUDE.md`. They are outside the lint globs or match kebab-case already.

A port's kebab name is its section-F type name without the `Port` suffix: `AdsPort` → `ads`, `PurchasePort` → `purchase`, `ErrorLogPort` → `error-log`. `SaveStore` and `SqlDriver` keep their role noun: `save-store`, `sql-driver`. That gives, for example:

```
packages/shell/src/services/
  ads/            ads-port.ts  admob-ads-adapter.ts  fake-ads.ts  ad-policy.ts  ad-policy.test.ts
  purchase/       purchase-port.ts  expo-iap-purchase-adapter.ts  fake-purchase.ts
  save/           save-store.ts  sql-driver.ts  sqlite-save-store.ts  expo-sqlite-sql-driver.ts  fake-save-store.ts
  clock/          clock-port.ts  system-clock-adapter.ts  fake-clock.ts
  error-log/      error-log-port.ts  fake-error-log.ts
```

The adapter's factory is `create` + PascalCase file name: `createAdmobAdsAdapter`, `createSqliteSaveStore`, `createFakePurchase`. The owning docs (docs/06, 09, 11, 12) own what goes inside these files; this doc owns only their names.

### 3. Identifiers

| Kind | Format | Example |
|---|---|---|
| Local variable, parameter, function, method | camelCase, verb for functions | `nextSeed`, `applyMove`, `formatDuration` |
| Module-level fixed data | UPPER_CASE | `COLUMN_HEIGHT`, `ALLOWED_LICENSES` |
| Module-level object created by a call | camelCase | `styles = StyleSheet.create(...)`, `rootStack = createNativeStackNavigator(...)` |
| Component (function or variable holding one) | PascalCase | `LevelTile`, `Navigation = createStaticNavigation(rootStack)` |
| Boolean | prefixed | `isPaused`, `canUndo`, `IS_STORE_BUILD` |
| Unused parameter | `_` + name | `(_event, isSuccess) => …` |
| Type, type alias | PascalCase | `LevelPack`, `SettingsState` |
| Type parameter | `T` / `TName` | `Result<TValue, TError>` |
| Object keys | any (mirror the data) | `{ 'max-lines': … }`, `{ textAlign: … }` |

Leading or trailing underscores are forbidden everywhere else (`_cache`, `value_`), including "private" module state: use a non-exported `const` instead.

React Navigation's static API is written as `const rootStack = createNativeStackNavigator({ … })` (camelCase: it is a config object) and `export const Navigation = createStaticNavigation(rootStack)` (PascalCase: it is a component). The React Navigation docs spell the first one `RootStack`; our naming-convention rejects that (verified on 2026-09-26), so use `rootStack` and `StaticParamList<typeof rootStack>`.

### 4. Types

- `type` aliases only. `interface` appears only inside `*.d.ts` files that merge into global namespaces (`NodeJS.ProcessEnv`, `ReactNavigation.RootParamList`), because merging needs it.
- Props: `<Component>Props`. State: `<Domain>State`. Actions: `<Domain>Action`. Port: section-F name. Result errors: `<Operation>Error` (`MoveError`, `SaveLoadError`), always a `kind` union.
- A game's concrete engine types are prefixed with the game in PascalCase: `LineSiegeState`, `LineSiegeMove`, `LineSiegeEvent`, and the type map the game-kit contract takes, `LineSiegeTypes`. Generic game-kit code uses type parameters instead (`TState`, `TMove`).
- Literal unions for closed sets: `type Direction = 'ltr' | 'rtl'`. When the set is also needed at runtime, derive the type from an `as const` array (rule 7) so the two never drift.

### 5. React: components, hooks, props, handlers

```tsx
// packages/shell/src/ui/level-tile.tsx (naming illustration; the real LevelTile is docs/05 section 3.9)
import { Pressable } from 'react-native';

import { AppText } from '@e07/shell/ui/app-text.tsx';

export type LevelTileProps = {
  readonly level: number;
  readonly label: string;
  readonly a11yLabel: string;
  readonly isLocked: boolean;
  readonly onSelect: (level: number) => void;
};

/** One tile of the Levels grid (spec S8). Text arrives translated from the screen. */
export function LevelTile({
  level,
  label,
  a11yLabel,
  isLocked,
  onSelect,
}: LevelTileProps): React.JSX.Element {
  const handlePress = (): void => {
    onSelect(level);
  };
  return (
    <Pressable
      role="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: isLocked }}
      testID={`levels.level-tile.${String(level)}`}
      onPress={handlePress}
    >
      <AppText text={label} />
    </Pressable>
  );
}
```

- This sample shows the naming only; docs/05 owns the real `LevelTile` (in `screens/levels/`, built on `TileButton`) and its props, and docs/05's lint additions allow a raw `Pressable` only inside `ui/`.
- The component is named after its file, has a `<Component>Props` type and a named export.
- The handler is `handlePress`; the callback prop is `onSelect`. Handlers are synchronous (docs/04 rule on async handlers).
- Boolean props follow rule 6 (`isLocked`) unless React Native already names the prop (`disabled`, `selected`, `visible`), in which case the RN name wins so the prop can be passed straight through. Destructure such a prop with a rename (`{ disabled: isDisabled }`); a bare `{ disabled }` parameter fails naming-convention.
- Hooks: `use` + PascalCase verb or noun (`useBoardGestures`, `useReportError`), one hook per `use-*.ts` file.

### 6. Stores, reducers and actions

FINAL A.5 puts logic in pure reducers and keeps Zustand stores thin. Names:

| Part | File | Export |
|---|---|---|
| State type | `settings-reducer.ts` | `type SettingsState` |
| Action union | `settings-reducer.ts` | `type SettingsAction` |
| Reducer | `settings-reducer.ts` | `settingsReducer(state, action)` |
| Default state | `settings-reducer.ts` | `DEFAULT_SETTINGS` |
| Store hook | `settings-store.ts` | `useSettingsStore` |
| Selectors | `settings-selectors.ts` | `selectIsSoundOn(state)` |

Actions carry a `type` discriminant whose value is an imperative, kebab-case request to the reducer:

```ts
// packages/shell/src/stores/settings-reducer.ts (naming illustration; the real reducer is docs/06 section 4.2)
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type SettingsState = {
  readonly theme: ThemePreference;
  readonly isSoundOn: boolean;
};

export type SettingsAction =
  | { readonly type: 'set-theme'; readonly theme: ThemePreference }
  | { readonly type: 'toggle-sound' };

export const DEFAULT_SETTINGS: SettingsState = { theme: 'system', isSoundOn: true };

/** Pure reducer: every settings change goes through here (spec S11). */
export function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'set-theme':
      return { ...state, theme: action.theme };
    case 'toggle-sound':
      return { ...state, isSoundOn: !state.isSoundOn };
  }
}
```

Standard action verbs, so the same intent has the same word everywhere: `set-<field>` (replace a value), `toggle-<flag>`, `reset-<thing>` (`reset-progress`, `reset-statistics`), `record-<fact>` (`record-level-result`), `apply-move`, `undo`, `use-hint`, `use-continue`, `pause`, `resume`, `restart-level`.

### 7. Game engine names: functions, moves, events, intents, tracks, outcomes

The engine function names are canonical (FINAL F): `create`, `listMoves`, `applyMove`, `outcome`, `intentToMove`, `buildTimeline`, `draw`, plus the worklet helpers named in FINAL B.12 and B.16: `sampleTimeline`, `hitTest`, `classifySwipe`. The contract type is `GameModule`. Do not invent synonyms (`step`, `reduce`, `nextState`, `isOver`) for these.

Every data union uses a `kind` discriminant whose value is a kebab-case string literal. The grammar tells the agent which union a value belongs to:

| Union | Grammar of `kind` | Examples |
|---|---|---|
| `…Move` (player command, input to `applyMove`) | imperative verb or verb-noun | `'place-block'`, `'tilt'`, `'shove'`, `'swap'`, `'draw-card'` |
| `…Event` (fact, output of `applyMove`) | past-tense noun-verbed | `'block-placed'`, `'column-cleared'`, `'beam-fired'`, `'monster-hit'`, `'sheep-penned'` |
| `InputIntent` (from `useBoardGestures`) | gesture noun | `'tap'`, `'long-press'`, `'swipe'`, `'drag-end'` |
| `Track` (animation, from `buildTimeline`) | visual primitive noun | `'tween'`, `'burst'`, `'shake'`, `'flash'` |
| `Outcome` (from `outcome`) | state word | `'playing'`, `'won'`, `'lost'` |
| `…Error` (inside a `Result`) | what went wrong, noun phrase | `'column-out-of-range'`, `'newer-schema'`, `'store-unavailable'` |
| Reducer action (`type`, not `kind`) | imperative request | `'apply-move'`, `'undo'`, `'set-theme'` |

```ts
// apps/line-siege/src/rules/line-siege-types.ts
export type LineSiegeMove =
  | { readonly kind: 'place-block'; readonly trayIndex: number; readonly column: number }
  | { readonly kind: 'rotate-block'; readonly trayIndex: number };

export type LineSiegeEvent =
  | { readonly kind: 'block-placed'; readonly column: number }
  | { readonly kind: 'column-cleared'; readonly column: number }
  | { readonly kind: 'beam-fired'; readonly column: number; readonly damage: number }
  | { readonly kind: 'monster-defeated'; readonly monsterId: number };

export type LineSiegeMoveError = { readonly kind: 'column-out-of-range'; readonly column: number };
```

Rules that follow from the grammar:

- One event per visible thing that happened; the name says what happened, not what to animate (`'column-cleared'`, never `'play-clear-animation'`). Sounds, haptics and counters map from events.
- `kind` values, stat-counter ids and sound ids are persisted (saves, replays, run logs, exported state). Treat them as a public format: renaming one needs a save migration and a `Gate-Change:` trailer if a golden or fixture changes.
- Sound and haptic cue ids are kebab nouns (`'place'`, `'clear'`, `'win'`, `'lose'`, `'tap'`); statistic counter ids are kebab nouns (`'monsters-defeated'`).
- `left`/`right`/`up`/`down` are fine as data inside rules (a swipe direction); the physical-direction ban only applies to style objects (docs/04).

The `kindValue` and `kindTypeValue` selectors reject any `kind` or `type` literal containing a character outside `[a-z0-9-]` in app code and tests. Tooling is exempt, because it talks to external formats (the App Store Connect API uses camelCase resource `type` values).

### 8. testIDs

Format: `<scope>.<element>[.<part-or-key>…]`, every segment `[a-z0-9]+(-[a-z0-9]+)*`, at least two segments.

- `<scope>` is the screen's route name in kebab-case (`Home` → `home`, `SettingsLanguage` → `settings-language`), an overlay (`pause`, `result`), a dialog (`reset-progress-dialog`) or `debug`.
- `<element>` is a kebab noun. Interactive elements end in their role: `-button`, `-switch`, `-slider`, `-row`, `-tile`, `-card`, `-tab`. Text and containers need no suffix (`home.title`, `game.board`, `debug.network-attempts`).
- Repeated items append a stable data key, never a list index: `levels.level-tile.12`, `settings-language.language-row.ckb`.
- Reusable components take a `testID` prop and derive their parts by appending a segment: `settings.top-bar` → `settings.top-bar.back-button`.
- testIDs are not user-visible and are never translated; they are exempt from the i18n lint rules.
- The Skia board has no internal testIDs (canvas content is invisible to the accessibility tree). Its wrapper is `game.board`; E2E taps on cells use coordinates from `BoardLayout`, which test builds publish in the `game.board-layout` text (docs/07 section 3.12, docs/08).

Maestro selects with `id:`. Maestro treats the value as a regular expression; a `.` matches itself, so `home.play-button` works unescaped.

```yaml
# packages/shell/e2e/flows/smoke/01-first-launch.yaml (excerpt; the full flow is in docs/07 section 3.11)
- tapOn:
    id: 'language-choice.continue-button'
- assertVisible:
    id: 'game.board'
```

Only literal testIDs are linted. For a dynamic id, write a template literal whose static parts already follow the format (`` `levels.level-tile.${String(level)}` ``).

### 9. i18n keys

Grammar (checked by the catalog linter behind `npm run i18n:verify`, which docs/10 implements):

```
key        = segment "." segment [ "." segment ]{0,3}      2 to 5 segments
segment    = [a-z0-9]+ ( "-" [a-z0-9]+ )*                   lowercase ASCII kebab-case
regex      = ^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*){1,4}$
prefix     = the game id in game catalogs; never a game id in Shell catalogs
```

| Catalog | Location | First segment | Examples |
|---|---|---|---|
| Shell | `packages/shell/src/i18n/catalogs/{en,de,fa,ckb}.json` | a screen area (route name in kebab-case; the Game screen uses `game-screen`, as docs/10 does), or `common`, `dialog`, `date` | `home.play-button.continue`, `premium.buy-button.label`, `dialog.reset-progress.title`, `game-screen.mode.daily`, `common.back`, `date.month-short.9` |
| Game module | `apps/<game-id>/src/i18n/{en,de,fa,ckb}.json` | the game id | `line-siege.title`, `line-siege.lose.broke-through`, `line-siege.tutorial.step-1`, `line-siege.stats.monsters-defeated` |

- **Semantic, not textual.** `home.play-button.continue` holds "Continue - Level {level, number}". If the English wording changes, the key stays. Never put the English words into the key (`home.continue-level`).
- **Last segment names the role** when an element has several texts: `.title`, `.body`, `.label`, `.a11y-label`, `.a11y-hint`.
- **One sentence, one key** (spec N12). Plurals and selects live inside the message (`{movesCount, plural, one {# move} other {# moves}}`); never `…moves-one` / `…moves-other` keys.
- **Placeholders are camelCase** and name the value; they mirror the object passed to `t()`. Numbers are typed (`{level, number}`), counted nouns are plurals (`{movesCount, plural, …}`), and a plain `{x}` is allowed only for free text whose name ends in `Name` or `Text` (`{packName}`, `{dateText}`, `{priceText}`) (docs/10 rule 5).
- **Keys are string literals at the call site** (`t('home.play-button.continue', { level })`) or come from a typed table of literals (`THEME_LABEL_KEYS[theme]`, docs/10's `MONTH_SHORT_KEYS[month - 1]`), never from string building (`` `date.month-short.${month}` ``). The catalog tools and the `ShellMessageKey` type can only check keys they can see.
- **Game keys are passed, not built.** The Shell never composes a game key; the game hands its keys to the Shell through the `GameModule` contract (labels, pack names, lose reasons) as a typed table of branded keys (docs/10's `asGameKey`).
- Catalog files are flat JSON objects (key → ICU message), keys sorted alphabetically, one file per language code (`en`, `de`, `fa`, `ckb`); docs/10 has the format and the linter rules.

### 10. Tests

| Kind | File | Runs in |
|---|---|---|
| Unit / component | `<unit>.test.ts(x)` next to the unit | `npm test` (Jest project `unit`) |
| Data golden | `<unit>.golden.test.ts` | `npm run test:golden` |
| Bot / balance simulation | `<unit>.sim.test.ts` | `npm run test:sim` (not pre-commit) |
| Integration | `test/integration/<area>/<name>.test.ts` (repo root) | `npm test` |
| Frozen save fixture | `fixtures/save-v<N>[.<case>].json` next to the migration tests (`save-v1.full.json`) | gated (`Gate-Change:`) |

Titles: `describe('applyMove')` (the exported name, exactly) → optional `describe('when the column is full')` → `it('emits a column-cleared event')`. The first word of every `it` title is a third-person verb or `can` (`returns`, `emits`, `keeps`, `rejects`, `shows`). Fixture builders are `make<Thing>()` (`makeLineSiegeState({ score: 10 })`).

### 11. Packages, apps and store identifiers

| Thing | Rule | Example |
|---|---|---|
| Workspace package | `@e07/<folder>` (scope is a placeholder until the framework is named, FINAL A.8) | `@e07/game-kit`, `@e07/shell`, `@e07/tooling` |
| App workspace | `@e07/<game-id>` | `@e07/line-siege` |
| Game id / app folder / Expo `slug` / commit scope | kebab-case, stable forever | `line-siege` |
| Display name (`expo.name`) | the game's real name; prebuild derives the Xcode scheme from it without spaces | `Line Siege` → `LineSiege.xcworkspace` |
| Bundle id (iOS) and package (Android) | `io.applander.<game id without hyphens>`, all lowercase, the same on both platforms (FINAL H.4); it also matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$` (FINAL A.9). The release gates reject `com.example.*` and other placeholders | `io.applander.linesiege` |
| Premium product id | `<bundle id>.premium` | `io.applander.linesiege.premium` |

Cross-folder imports use the package name plus the path under `src/` and the file extension (`@e07/shell/ui/app-text.tsx`); details in docs/04.

### 12. npm scripts, ports and env vars

The npm script names are fixed by FINAL F: `verify`, `check:fast`, `format`, `format:check`, `lint`, `typecheck`, `test`, `test:golden`, `test:sim`, `test:coverage`, `test:mutation`, `knip`, `audit:network`, `audit:privacy`, `audit:licenses`, `i18n:verify`, `e2e:ios`, `screenshots:ios`, `build:ios:sim`, `release:ios`, `new-game` (their exact commands are in docs/16). A new script follows the same shape: `<verb>` or `<area>:<verb>`, kebab-case words. Pass a game with `-- --app <game-id>` and a build variant with `--variant test|store` (docs/14).

Environment variables are UPPER_SNAKE_CASE. Build-time variables: `APP_VARIANT` (`test` | `store`) and `ADS_MODE` (`off` | `test` | `live`). A value the app reads at runtime must be prefixed `EXPO_PUBLIC_` (Expo inlines only those, and only with dot access) and declared in `packages/shell/src/app-env.d.ts`; today that is only `EXPO_PUBLIC_APP_VARIANT`.

### 13. Git: branches, commits, trailers, tags

**Commits.** Conventional Commits 1.0.0 header, then a blank line, a body explaining *why*, and trailers in the last paragraph:

```
feat(line-siege): fire a beam when a column clears

The beam damage uses the cleared column's height so tall stacks pay off
(spec 13, game 1). Tests cover the damage table and the monster queue.

Gate-Change: new golden for daily 2026-09-26 after the damage table change
Spec-Change: spec 13 Line Siege damage rule clarified by the owner
```

| Part | Rule |
|---|---|
| type | `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert` |
| scope | a directory name under `apps/` or `packages/` (`line-siege`, `shell`, `game-kit`, `tooling`), or `repo`, `deps`, `docs`, `ci`; optional but expected |
| subject | imperative, lowercase start, no trailing period, header at most 72 characters |
| `!` | only for a change that breaks saved data or a public contract (rare; migrations normally prevent it) |
| `Gate-Change: <reason>` | required when a staged file matches `gatedPaths` in `quality-gates.json` |
| `Spec-Change: <spec section and what changed>` | required when an existing test's expectation changes because the spec changed (FINAL D.41); never used for "the test was wrong" |
| Attribution | keep any `Co-Authored-By:` trailer the session instructions require, in the same final trailer block |

Git-generated headers (`Merge …`, `Revert "…"`, `fixup! …`, `squash! …`, `amend! …`) are accepted as they are.

**Branches** (only when one is needed): `<type>/<scope>-<slug>`, for example `feat/line-siege-endless-mode`.

**Tags** (created by `npm run release:ios`, docs/14 owns the procedure):

| Tag | When | Example |
|---|---|---|
| `<game-id>/v<X.Y.Z>+<build>` | after every successful upload to App Store Connect (test and store builds) | `line-siege/v1.0.0+8` |
| `<game-id>/v<X.Y.Z>` | when the owner says "ship" for that version | `line-siege/v1.0.0` |

`X.Y.Z` is `expo.version` (CFBundleShortVersionString); `<build>` is the monotonic build number in `game.config.ts` (CFBundleVersion). PATCH is fixes only, MINOR adds features or level packs, MAJOR is an owner decision. Both forms pass `git check-ref-format`. The Shell and the packages are not tagged: they ship inside the apps.

### 14. The enforcing configuration

These are the naming parts of `eslint.config.mjs`, copied from the complete, verified file in docs/04 (do not edit them here; edit the real file with a `Gate-Change:` trailer).

File and folder names (block 4 and block 5 of the config):

```js
// eslint.config.mjs (excerpt)
'check-file/filename-naming-convention': [
  'error',
  { '**/*.{ts,tsx}': 'KEBAB_CASE' },
  { ignoreMiddleExtensions: true },
],
'check-file/folder-naming-convention': [
  'error',
  { '{apps,packages,test}/**/': 'KEBAB_CASE' },
],
// Runtime code (block 5) also blocks barrels:
'check-file/filename-blocklist': [
  'error',
  {
    '**/{util,utils,helper,helpers,misc,common,shared,stuff}.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
    'packages/*/src/**/index.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
    'apps/*/src/*/**/index.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
  },
],
```

(`check-file` requires the suggestion to be a valid glob; `**/[a-z]*-[a-z]*.ts` reads as "a descriptive kebab-case name". A free-text suggestion makes the rule crash on every file, verified.)

Identifiers (block 2):

```js
// eslint.config.mjs (excerpt)
const BOOLEAN_PREFIXES = ['is', 'has', 'can', 'should', 'did', 'will', 'was'];

'@typescript-eslint/naming-convention': [
  'error',
  { selector: 'default', format: ['camelCase'], leadingUnderscore: 'forbid', trailingUnderscore: 'forbid' },
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
  { selector: 'typeParameter', format: ['PascalCase'], custom: { regex: '^(T|T[A-Z][A-Za-z]+)$', match: true } },
  // Object keys may mirror external APIs, style props or catalog keys.
  { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
],
```

The boolean selector checks the name *after* removing the prefix: `isReady` → `Ready` (PascalCase), `IS_STORE_BUILD` → `STORE_BUILD` (UPPER_CASE).

testIDs and `kind`/`type` values (entries of the shared `SYNTAX` table used by `no-restricted-syntax` in runtime code and tests):

```js
// eslint.config.mjs (excerpt)
const KEBAB = '[a-z0-9]+(-[a-z0-9]+)*';

testIdFormat: {
  selector: `JSXAttribute[name.name='testID'] > Literal[value!=/^${KEBAB}(\\.${KEBAB})+$/]`,
  message: "testID is '<screen>.<element>' in kebab-case, e.g. 'home.play-button' (docs/03).",
},
kindValue: {
  selector: `Property[key.name=/^(kind|type)$/] > Literal[value=/[^a-z0-9-]/]`,
  message: "`kind`/`type` values are kebab-case string literals, e.g. 'column-cleared' (docs/03).",
},
kindTypeValue: {
  selector: `TSPropertySignature[key.name=/^(kind|type)$/] TSLiteralType > Literal[value=/[^a-z0-9-]/]`,
  message: "`kind`/`type` values are kebab-case string literals, e.g. 'column-cleared' (docs/03).",
},
```

Commit messages: the pure rules module behind the lefthook `commit-msg` job (the CLI wrapper and the hook are in docs/16):

```ts
// packages/tooling/src/git/commit-message-rules.ts
import path from 'node:path';

export const COMMIT_TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'test',
  'docs',
  'build',
  'ci',
  'chore',
  'style',
  'revert',
] as const;

export const MAX_HEADER_LENGTH = 72;

export type CommitCheckInput = {
  readonly message: string;
  readonly stagedFiles: readonly string[];
  readonly gatedPatterns: readonly string[];
  readonly allowedScopes: readonly string[];
};

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9-]+)\))?!?: (?<subject>\S.*)$/u;
const TRAILER = /^Gate-Change: +\S/mu;
const GIT_GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/u;

/** Returns every problem with a commit message; an empty list means the commit may proceed. */
export function checkCommitMessage(input: CommitCheckInput): readonly string[] {
  const header = input.message.split('\n')[0] ?? '';
  if (GIT_GENERATED.test(header)) {
    return [];
  }
  return [...checkHeader(header, input.allowedScopes), ...checkGateTrailer(input)];
}

function checkHeader(header: string, allowedScopes: readonly string[]): readonly string[] {
  const match = HEADER.exec(header);
  if (match?.groups === undefined) {
    return [`Header must look like "type(scope): subject", got "${header}".`];
  }
  const { type = '', scope, subject = '' } = match.groups;
  const problems: string[] = [];
  if (!COMMIT_TYPES.some((allowed) => allowed === type)) {
    problems.push(`Unknown type "${type}". Use one of: ${COMMIT_TYPES.join(', ')}.`);
  }
  if (scope !== undefined && !allowedScopes.includes(scope)) {
    problems.push(`Unknown scope "${scope}". Use one of: ${allowedScopes.join(', ')}.`);
  }
  if (header.length > MAX_HEADER_LENGTH) {
    problems.push(`Header is ${String(header.length)} characters; the limit is 72.`);
  }
  if (subject.endsWith('.')) {
    problems.push('Subject must not end with a period.');
  }
  return problems;
}

function checkGateTrailer(input: CommitCheckInput): readonly string[] {
  const gated = input.stagedFiles.filter((file) =>
    input.gatedPatterns.some((pattern) => path.matchesGlob(file, pattern)),
  );
  if (gated.length === 0 || TRAILER.test(input.message)) {
    return [];
  }
  return [
    `These staged files are quality gates: ${gated.join(', ')}.`,
    'Add a trailer line "Gate-Change: <why the gate had to change>" at the end of the message.',
  ];
}
```

```ts
// packages/tooling/src/git/commit-message-rules.test.ts
import { checkCommitMessage, type CommitCheckInput } from './commit-message-rules.ts';

const BASE: CommitCheckInput = {
  message: 'feat(line-siege): add endless mode',
  stagedFiles: ['apps/line-siege/src/rules/apply-move.ts'],
  gatedPatterns: ['eslint.config.mjs', '**/__snapshots__/*.golden.test.ts.snap'],
  allowedScopes: ['line-siege', 'shell', 'game-kit', 'tooling', 'repo', 'deps'],
};

describe('checkCommitMessage', () => {
  it('accepts a conventional header', () => {
    expect(checkCommitMessage(BASE)).toStrictEqual([]);
  });

  it('rejects an unknown scope', () => {
    const problems = checkCommitMessage({ ...BASE, message: 'fix(ui): align text' });
    expect(problems).toHaveLength(1);
  });

  it('skips headers that git generates', () => {
    expect(checkCommitMessage({ ...BASE, message: 'Merge branch main' })).toStrictEqual([]);
  });

  describe('when a gated file is staged', () => {
    const gated = { ...BASE, stagedFiles: ['eslint.config.mjs'] };

    it('requires a Gate-Change trailer', () => {
      expect(checkCommitMessage(gated)).toHaveLength(2);
    });

    it('accepts the trailer in the last paragraph', () => {
      const message = `${BASE.message}\n\nWhy.\n\nGate-Change: allow Math.PI in rules`;
      expect(checkCommitMessage({ ...gated, message })).toStrictEqual([]);
    });
  });
});
```

## Checklist

Before calling any work done:

- [ ] `npm run check:fast` passes (it runs check-file, naming-convention and the `kind`/testID selectors).
- [ ] Every new file is kebab-case, its main export is named after it, and its first line is `// <repo-relative path>`. Check headers with:
  `git ls-files '*.ts' '*.tsx' | while read -r f; do head -n1 "$f" | grep -qxF "// $f" || echo "missing header: $f"; done`
- [ ] No new `utils`/`helpers`/`common`/`index` files (except the two allowed `index.ts` files per app).
- [ ] New ports, adapters and fakes use the section-F names and the `<vendor>-<port>-adapter.ts` / `fake-<port>.ts` patterns.
- [ ] New moves are imperative, new events past tense, all `kind`/`type` values kebab-case.
- [ ] Every interactive element has a `<screen>.<element>` testID, and Maestro flows select by `id:` only.
- [ ] New i18n keys match the key regex, start with the right namespace (game id for game catalogs), exist in all four catalogs, and are string literals at the call site; `npm run i18n:verify` passes.
- [ ] Test files use the right suffix and `it` titles start with a third-person verb.
- [ ] The commit header passes the `commit-msg` hook; a `Gate-Change:` trailer is present if any gated path changed; a `Spec-Change:` trailer if a test expectation changed because of the spec.
- [ ] Tags (release step only) are `<game-id>/vX.Y.Z` and `<game-id>/vX.Y.Z+<build>`, created by `npm run release:ios`, never moved.

## Sources

- Expo default template (kebab-case file names): https://github.com/expo/expo/tree/main/templates/expo-template-default
- Google TypeScript style guide, naming: https://google.github.io/styleguide/tsguide.html#naming
- TypeScript handbook, objects vs enums: https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums
- React, responding to events (handler and prop names): https://react.dev/learn/responding-to-events
- React, custom hook names: https://react.dev/learn/reusing-logic-with-custom-hooks#hook-names-always-start-with-use
- React Navigation static API and type checking: https://reactnavigation.org/docs/typescript
- typescript-eslint naming-convention: https://typescript-eslint.io/rules/naming-convention
- eslint-plugin-check-file: https://github.com/dukeluo/eslint-plugin-check-file
- ESLint selectors (esquery): https://eslint.org/docs/latest/extend/selectors
- React Native `testID`: https://reactnative.dev/docs/view#testid
- Maestro selectors: https://docs.maestro.dev/api-reference/selectors
- FormatJS CLI (`verify`): https://formatjs.github.io/docs/tooling/cli
- ICU MessageFormat syntax: https://formatjs.github.io/docs/core-concepts/icu-syntax
- Conventional Commits 1.0.0: https://www.conventionalcommits.org/en/v1.0.0/
- git interpret-trailers: https://git-scm.com/docs/git-interpret-trailers
- Semantic Versioning 2.0.0: https://semver.org/
- Apple CFBundleVersion / CFBundleShortVersionString: https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion

## Verified

On 2026-09-26, in a throwaway monorepo copy with the canonical layout (`scratchpad/rn/writer-03-04-16/repo`, npm workspaces, Node 26.4.0, npm 11.17.0, TypeScript 6.0.3, ESLint 9.39.5, typescript-eslint 8.70.1, eslint-plugin-check-file 3.3.2, eslint-config-expo 57.0.2, React Native 0.86.3, lefthook 2.1.14):

- A deliberately bad component produced errors for: `BadName.tsx` (check-file), folder `BadDir` (check-file), boolean `loading`, boolean parameter `visible`, constant `Bad_name`, enum `Mode`, testID `HomePlay`, `kind: 'ColumnCleared'` (object) and `kind: 'blockPlaced'` (type literal). Correct names passed.
- Reviewer re-check (same day, copy under `scratchpad/rn/verify-conventions/repo`): a destructured boolean parameter `({ disabled }: Props)` and a destructured variable `const { granted } = …` are both rejected by naming-convention; the renamed forms `{ disabled: isDisabled }` and `{ granted: isGranted }` pass. The `line-siege-types.ts` example type-checks and lints clean.
- `left`/`right` keys in a rules file were accepted (data), while `marginLeft` in a style object was rejected.
- `const RootStack = createNativeStackNavigator(…)` is rejected by naming-convention; `rootStack` plus `StaticParamList<typeof rootStack>` and the `ReactNavigation.RootParamList` merge in a `.d.ts` type-check and lint cleanly.
- `check-file/filename-blocklist` crashes with "invalid pattern" when the suggestion is free text; the glob suggestion above works.
- The commit-message rules: 5 Jest tests pass; with lefthook installed, `Updated stuff.` and `feat(ui): …` were rejected, `feat(line-siege): export engine entry` was accepted, and a commit staging `eslint.config.mjs` was rejected until a `Gate-Change:` trailer was added.
- Re-verify versions when they age: `npm view eslint-plugin-check-file version`, `npm view typescript-eslint version`, and `npx expo install --check` in each app.

## Open issues

1. **App workspace package name.** This doc fixes app workspaces as `@e07/<game-id>`; the architecture and testing workspaces seen on 2026-09-26 use `@e07/line-siege` too. Commit scopes stay the folder name either way.
2. **i18n namespace and placeholders.** Aligned with docs/10 as of 2026-09-26: game keys start with the game id, 2 to 5 segments, sorted catalogs; plain placeholders end in `Name`/`Text` (`{priceText}`), numbers are `{x, number}` or plurals.
3. **Resolved: discriminant names.** `kind` for data unions and `type` for reducer actions is decided here; docs/02, 06, 08, 11 and 12 use the same fields with kebab-case values (checked in the integration pass on 2026-09-26).
4. **Resolved: fake factory names.** Rule 2 gives `fake-ads.ts` → `createFakeAds()` and `fake-purchase.ts` → `createFakePurchase()`; docs/07, 11 and 12 now use exactly these names.
