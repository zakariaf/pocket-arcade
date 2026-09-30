# Identifiers, types, React parts, stores and actions

How values, constants, types, components, hooks, handlers, props, stores, reducers and actions are named, with the exact ESLint `naming-convention` configuration that enforces most of it. Read this when naming anything inside a file, or when `@typescript-eslint/naming-convention` reports an error.

## Contents

- Identifiers
- Types
- React: components, hooks, props, handlers, screens, routes
- Stores, reducers and actions
- The enforcing ESLint configuration

## Identifiers

| Kind | Format | Example |
|---|---|---|
| Local variable, parameter, function, method | camelCase, a verb for functions | `nextSeed`, `applyMove`, `formatDuration` |
| Module-level fixed data (a literal, a regex, an `as const` table) | UPPER_CASE | `COLUMN_HEIGHT`, `ALLOWED_LICENSES`, `HEADER = /^…$/u` |
| Module-level object created by a call | camelCase | `styles = StyleSheet.create(...)`, `rootStack = createNativeStackNavigator(...)` |
| Module-level object that assembles a module | camelCase | `gameConfig` in `game.config.ts`, `lineSiegeGame` in `src/index.ts` |
| Component (function or variable holding one) | PascalCase | `LevelTile`, `Navigation = createStaticNavigation(rootStack)` |
| Boolean | prefixed | `isPaused`, `canUndo`, `IS_STORE_BUILD` |
| Unused parameter | `_` + name | `(_event, isSuccess) => …` |
| Type, type alias | PascalCase | `LevelPack`, `SettingsState` |
| Type parameter | `T` / `TName` | `Result<TValue, TError>` |
| Object keys | any (mirror the data) | `{ 'max-lines': … }`, `{ textAlign: … }` |

- Leading or trailing underscores are forbidden everywhere else (`_cache`, `value_`), including "private" module state: use a non-exported `const` instead.
- Acronyms are words: `SqlDriver`, `isRtl`, `AdmobAdsAdapter`, `loadHttpUrl` (`acronym-case`). External names stay as their owner spells them (`I18nManager.isRTL`, the `testID` prop).
- Booleans read as questions: `is`, `has`, `can`, `should`, `did`, `will`, `was` (`isReady`, `hasHint`, `wasRestored`). UPPER_CASE booleans use `IS_`, `HAS_`, … (`IS_STORE_BUILD`). The ESLint boolean selector checks the name after removing the prefix: `isReady` → `Ready` (PascalCase), `IS_STORE_BUILD` → `STORE_BUILD` (UPPER_CASE).
- Destructured booleans are renamed while destructuring: `const { granted: isGranted } = permission`, `({ disabled: isDisabled }: ButtonProps)`. A bare `{ disabled }` parameter fails naming-convention (verified).
- React Navigation's static API: `const rootStack = createNativeStackNavigator({ … })` (camelCase: a config object) and `export const Navigation = createStaticNavigation(rootStack)` (PascalCase: a component). The React Navigation docs spell the first `RootStack`; naming-convention rejects that (verified), so use `rootStack` and `StaticParamList<typeof rootStack>`.
- Engine function names are canonical: `create`, `listMoves`, `applyMove`, `outcome`, `intentToMove`, `buildTimeline`, `draw`, and the worklet helpers `sampleTimeline`, `hitTest`, `classifySwipe`. The contract type is `GameModule`. Do not invent synonyms (`step`, `reduce`, `nextState`, `isOver`).

## Types

- `type` aliases only. `interface` appears only inside `*.d.ts` files that merge into global namespaces (`NodeJS.ProcessEnv`, `ReactNavigation.RootParamList`), because merging needs it.
- No `I` prefix (`IAdsPort`), no plain `Props` or `State` (`type-name`).
- Props: `<Component>Props`. State: `<Domain>State`. Actions: `<Domain>Action`. Port: the canonical name. Result errors: `<Operation>Error` (`SaveLoadError`, `PurchaseError`), always a `kind` union. (A game's `applyMove` throws a `RangeError` for an illegal move instead of returning an error.) Options objects: `<Function>Options`.
- A game's concrete engine types are prefixed with the game in PascalCase: `LineSiegeState`, `LineSiegeMove`, `LineSiegeEvent`, `LineSiegeResult`, and the type bag the Shell takes, `LineSiegeTypes`. Generic game-kit code uses type parameters instead (`TState`, `TMove`).
- Literal unions for closed sets: `type Direction = 'ltr' | 'rtl'`. When the set is also needed at runtime, derive the type from an `as const` array so the two never drift (`templates/string-union.ts`).

## React: components, hooks, props, handlers, screens, routes

The shape to imitate is `examples/level-tile.tsx`:

- The component is named after its file (`level-tile.tsx` → `LevelTile`), has a `<Component>Props` type and a named export, and gets a one-sentence TSDoc summary.
- Event handlers declared inside a component are `handleX` (`handlePress`); callback props are `onX` (`onSelect`). Pass a callback prop straight through when nothing else happens (`onPress={onPress}`); otherwise wrap it in a `handleX`. Inside a component (`.tsx`), a local function named `onPress`, or a local function `press` passed to an `on*` prop, is wrong (`handler-name`); a hook may name the callbacks it wires into a worklet after their slot (`onDone`), and an `on*` prop may take a value that is not a function (Skia's `onSize={size}` takes a shared value). Handlers are synchronous (typescript-and-lint-rules).
- Boolean props follow the prefix rule (`isLocked`) unless React Native already names the prop (`disabled`, `selected`, `visible`), in which case the RN name wins so the prop passes straight through; destructure it with a rename (`{ disabled: isDisabled }`).
- Hooks: `use` + PascalCase verb or noun (`useBoardGestures`, `useReportError`), one hook per `use-*.ts` file.
- Screens: `<Name>Screen` in `<name>-screen.tsx`; the screen's model hook is `use-<screen>-model.ts` → `use<Screen>Model`.
- Route names are PascalCase (`Home`, `SettingsLanguage`); the testID scope of a route is the route name in kebab-case (`settings-language`).

## Stores, reducers and actions

Logic lives in pure reducers and Zustand stores stay thin. Names:

| Part | File | Export |
|---|---|---|
| State type | `settings-reducer.ts` | `type SettingsState` |
| Action union | `settings-reducer.ts` | `type SettingsAction` |
| Reducer | `settings-reducer.ts` | `settingsReducer(state, action)` |
| Default state | `settings-reducer.ts` | `DEFAULT_SETTINGS` |
| Store hook | `settings-store.ts` | `useSettingsStore` |
| Selectors | `settings-selectors.ts` | `selectIsSoundOn(state)` |

Actions carry a `type` discriminant whose value is an imperative, kebab-case request to the reducer (`examples/settings-reducer.ts`). Standard action verbs, so the same intent has the same word everywhere:

| Verb | Meaning | Example |
|---|---|---|
| `set-<field>` | replace a value | `set-theme`, `set-language` |
| `toggle-<flag>` | flip a boolean | `toggle-sound` |
| `reset-<thing>` | back to defaults | `reset-progress`, `reset-statistics` |
| `record-<fact>` | append a fact | `record-level-result` |
| session verbs | game session control | `apply-move`, `undo`, `use-hint`, `use-continue`, `pause`, `resume`, `restart-level` |

## The enforcing ESLint configuration

These are the naming parts of the one `eslint.config.mjs` (the typescript-and-lint-rules skill holds the complete file; change it there, with a `Gate-Change:` trailer).

```js
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

File and folder names (blocks 4 and 5):

```js
'check-file/filename-naming-convention': ['error', { '**/*.{ts,tsx}': 'KEBAB_CASE' }, { ignoreMiddleExtensions: true }],
'check-file/folder-naming-convention': ['error', { '{apps,packages,test}/**/': 'KEBAB_CASE' }],
// Runtime code (block 5) also blocks barrels:
'check-file/filename-blocklist': ['error', {
  '**/{util,utils,helper,helpers,misc,common,shared,stuff}.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
  'packages/*/src/**/index.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
  'apps/*/src/*/**/index.{ts,tsx}': '**/[a-z]*-[a-z]*.ts',
}],
```

`check-file` requires the suggestion to be a valid glob; `**/[a-z]*-[a-z]*.ts` reads as "a descriptive kebab-case name". A free-text suggestion makes the rule crash on every file (verified).

The `kind`/`type` value and testID selectors (entries of the shared `SYNTAX` table used by `no-restricted-syntax` in runtime code and tests):

```js
const KEBAB = '[a-z0-9]+(-[a-z0-9]+)*';

testIdFormat: {
  selector: `JSXAttribute[name.name='testID'] > Literal[value!=/^${KEBAB}(\\.${KEBAB})+$/]`,
  message: "testID is '<screen>.<element>' in kebab-case, e.g. 'home.play-button' (naming-conventions).",
},
kindValue: {
  selector: `Property[key.name=/^(kind|type)$/] > Literal[value=/[^a-z0-9-]/]`,
  message: "`kind`/`type` values are kebab-case string literals, e.g. 'column-cleared' (naming-conventions).",
},
kindTypeValue: {
  selector: `TSPropertySignature[key.name=/^(kind|type)$/] TSLiteralType > Literal[value=/[^a-z0-9-]/]`,
  message: "`kind`/`type` values are kebab-case string literals, e.g. 'column-cleared' (naming-conventions).",
},
```

Verified on 2026-09-26: a deliberately bad component produced errors for `BadName.tsx`, folder `BadDir`, boolean `loading`, boolean parameter `visible`, constant `Bad_name`, enum `Mode`, testID `HomePlay`, `kind: 'ColumnCleared'` (object) and `kind: 'blockPlaced'` (type literal); a destructured `({ disabled }: Props)` and `const { granted } = …` were rejected and the renamed forms passed; `const RootStack = createNativeStackNavigator(…)` was rejected.
