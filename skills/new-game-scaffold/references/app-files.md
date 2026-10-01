# The files of a game app

Every file `scaffold-game.mjs` writes into `apps/<game-id>/`, why it looks the way it does, and what may change later. The Shell, not the app, owns everything that is the same in every game; an app holds its configuration and its game module.

## Contents

- The tree
- `package.json`
- `tsconfig.json`
- `metro.config.js`
- `app.config.ts`
- `game.config.ts`, field by field
- `index.ts`
- `.gitignore`
- `assets/fonts/`
- `src/i18n/*.json`
- An app that already exists: `--add-missing`
- What comes later in `src/`

## The tree

```
apps/<game-id>/
  package.json  tsconfig.json  metro.config.js  .gitignore
  app.config.ts        export default withShell(gameConfig, process.env)
  game.config.ts       every per-game value (spec 11)
  index.ts             placeholder until the module is assembled, then the 3-line entry
  assets/fonts/        LilitaOne.ttf Rubik-Regular.ttf Rubik-Bold.ttf Vazirmatn-Regular.ttf Vazirmatn-Bold.ttf + 3 OFL texts
  src/i18n/            en.json de.json fa.json ckb.json
  src/                 rules/ levels/ board/ theme/ art/ sounds/ tutorial/ testing/ (sim/ for real-time)
  e2e/flows/  e2e/baselines/
```

Generated and local-only folders (`ios/`, `android/`, `build/`, `dist/`, `sfx-preview/`) are never committed.

## `package.json`

```json
{ "name": "@e07/<game-id>", "version": "1.0.0", "private": true, "main": "index.ts",
  "exports": { "./*": "./src/*" }, "dependencies": { ... } }
```

- The `exports` map lets game code reach its own folders without `../`: `import type { FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts'`.
- **No `"type"` field:** `metro.config.js` is CommonJS. Node prints `MODULE_TYPELESS_PACKAGE_JSON` when tooling imports app code; pass `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`.
- **Dependencies are in lockstep with every other app:** the same packages at the same versions, because autolinking and `npx expo install --check` only see an app's own dependencies and every native module of the Shell must be linked in every app. The scaffold copies the list from the existing apps, which are identical (it fails `deps-lockstep` when they disagree, so the newest app and every other one give the same list); a later install or upgrade goes to all apps together (dependency-management). The scaffold never writes the versions table into an app.
- **With no other app** (an empty `apps/`, which the monorepo bootstrap normally never leaves), the template's list is the bootstrap pilot's minimal runtime set, the same shared file: `expo` `~57.0.25`, `expo-system-ui` `~57.0.4`, `react` 19.2.3, `react-native` 0.86.3, `@shopify/react-native-skia` 2.6.2, `react-native-gesture-handler` `~2.32.0`, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1 and `@e07/shell`. Every other package arrives with the skill that first imports it (knip fails on an unused dependency); there is no full-table fallback.
- Pure JavaScript libraries only the Shell imports (valibot, zustand, react-intl) are not app dependencies (knip would report them).

## `tsconfig.json`

Extends `../../tsconfig.base.json` (strict TypeScript 6 settings) with `types: ["jest"]` and includes `index.ts`, `game.config.ts`, `src/**/*`, the Shell's `app-env.d.ts` (for `process.env.EXPO_PUBLIC_APP_VARIANT`) and the Shell's `navigation/react-navigation.d.ts`. The last one is a global augmentation that types the routes: nothing imports it, so without the entry the app program sees an empty `RootParamList` and every `navigation.navigate(...)` in the Shell hooks the app imports fails with TS2769 `Argument of type '"Settings"' is not assignable to parameter of type 'never'`. Before the navigator exists the path matches no file, which is not an error. Type-check with `npx tsc --noEmit -p apps/<game-id>`.

## `metro.config.js`

```js
const config = getDefaultConfig(__dirname);
config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`;
```

`EXPO_PUBLIC_*` values are inlined at transform time but are not part of Metro's cache key; without the key a store build made after a test build reused the test transforms and shipped the debug menu (verified). It is JavaScript because Metro loads it directly.

## `app.config.ts`

One statement: `export default withShell(gameConfig, process.env);`, importing `withShell` from `@e07/shell/config/with-shell.ts` and `gameConfig` from `./game.config.ts`. The `.ts` extensions are required (Expo loads the file with Node's type stripping); `export default` is the tool-demanded exception to named exports; `process.env` is passed in so `withShell` stays pure. Every native setting comes from `withShell` and config plugins, never from `ios/`.

## `game.config.ts`, field by field

Spec section 11: one file per game holds every per-game value. It is read by `app.config.ts` only; app code never imports it (the runtime subset reaches the app as `expo.extra.game`).

| Field | Scaffold value | Rule |
|---|---|---|
| `id` | the game id | equals the folder, `identity.id` and the save document's `gameId` |
| `appName` | `{ en, de, fa, ckb }`, `LATIN_NAME` where equal | game names are Latin in every language by default; the owner reads fa/ckb names personally (an owner step that never blocks) |
| `bundleId` | `io.applander.<game id without hyphens>` (`bundleIdFor(id)`) | fixed by the owner's decision O4, all lowercase, the same on iOS and Android; `check-game-app.mjs` rule `bundle-id` at every stage, and `withShell` throws on anything else |
| `appStoreId` | `null` | the numeric Apple ID once the record exists (G2) |
| `version`, `buildNumber` | `'1.0.0'`, `1` | only the release pipeline bumps `buildNumber` |
| `premium` | `<bundleId>.premium`, price note `EUR 1.99 price point (owner decision)` | rule `premium-id` at every stage. Premium is the EUR 1.99 App Store price point with Family Sharing off (owner decisions O2 and O3); the app always shows the store's localised price, never this note, and the price lives in App Store Connect |
| `ads` | enabled, 3 levels before the first interstitial, 180,000 ms and 2 levels between, placeholder AdMob IDs | real IDs replace the placeholders after G5 (`--stage complete` rule `owner-placeholder` names each one until then); test builds use Google's test IDs through `ADS_MODE`, never written here |
| `modes` | daily on (`--no-daily` off), endless off (`--endless` on), or the copy deck's modes | `modes.endless` is `true` exactly when the levels spec has `endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY }` and `modes.daily` exactly when it has a daily (the level-generation skill's `check-levels` rule `endless-mode`, and `--stage complete` here) |
| `levels` | `{ packCount: 3, levelsPerPack: 30 }` | must match the generated packs |
| `hints.freePerDay` | `--hints none` → 0, `--hints solver` → 1 | from the game's rules: 1 free hint a day only when a solver proves the next move (spec 8.5); a game without an exact solver (Line Siege) has no hint |
| `isContinueAllowed` | `--continue once` → `true`, `--continue none` → `false` | `true` exactly when `rules.continueRun.kind === 'once'` (`--stage complete` fails a config that allows a continue the rules do not have) |
| `links` | `{ privacyPolicy: { host, path }, supportEmail }`, placeholders `example.com` and `support@example.com` | no `https://` literal in app files; the Shell composes the URL; the owner's privacy link replaces the placeholders at G3 (`owner-placeholder` until then) |
| `store` | general audience, age-rating answers; `violenceCartoonOrFantasy` from `--violence-rating` (default `'NONE'`) | App Store Connect `ageRatingDeclarations` names. The owner confirms the answers at step G1: `'INFREQUENT_OR_MILD'` when the game hits monsters or characters (Line Siege), `'NONE'` otherwise |

Never put `null` into anything that reaches `expo.extra` (it arrived as `{}` on the device); `withShell` omits absent keys.

`--hints` and `--continue` have no default for a new game: the script stops and asks for them, because only the game's rules know the answer. For the pilot (`line-siege`) they are known: hints `none`, continue `once` (the monsters fall back 3 rows and the two fullest rows clear), violence `INFREQUENT_OR_MILD`, modes levels, daily and endless.

The file comes from one shared template (`templates/app/game.config.ts`, the same bytes the monorepo bootstrap writes for the pilot), rendered by the shared `scripts/lib/app-files.mjs`: the placeholders `__MODE_DAILY__`, `__MODE_ENDLESS__`, `__HINTS_FREE_PER_DAY__`, `__IS_CONTINUE_ALLOWED__` and `__VIOLENCE_RATING__` are filled from the options above.

## `index.ts`

Until the module is assembled, a placeholder that registers an empty component, so the app type-checks, lints and prebuilds while the game is written. At assembly it becomes the 3-line entry (the blank line is required by `import/order`):

```ts
// apps/flock-tilt/index.ts
import { startShell } from '@e07/shell/app/start-shell.ts';

import { flockTiltGame } from './src/index.ts';
startShell(flockTiltGame);
```

`startShell` runs the Intl polyfills first, the layout-direction check second, then creates the Shell app. Nothing else goes in this file.

## `.gitignore`

`ios/`, `android/`, `build/`, `dist/`, `sfx-preview/`: prebuild regenerates the native projects (never edit them), builds and sound previews are local.

## `assets/fonts/`

The five Toybox fonts (Lilita One, Rubik Regular and Bold, Vazirmatn Regular and Bold) and the three OFL licence texts, byte for byte (`check-game-app.mjs` compares sha256). The Shell's `withShell` embeds them with the `expo-font` plugin from `./assets/fonts/`; board goldens and art scripts load them from the same folder. A missing file fails `expo config`; a different file changes the look and the licence list.

## `src/i18n/*.json`

Four flat catalogs (key to ICU message), keys sorted, every key starting with `<game-id>.`, the same keys in all four. Every catalog has `<game-id>.name`. What else the scaffold writes depends on the game:

| Game | Catalogs | Lose key |
|---|---|---|
| the pilot, `line-siege` | the canonical Line Siege set, byte for byte (`assets/line-siege-i18n/`, synced from the skill library; 24 keys: the deck texts plus `line-siege.lose.board-full`, `line-siege.progress.endless`, `line-siege.continue.push-back` and `line-siege.board.summary`, fa and ckb marked for native review) | `line-siege.lose.broke-through` and `line-siege.lose.board-full` |
| a game in the copy deck (`flock-tilt`, `scrap-shove`) | `<id>.name` plus the deck's texts, mapped as below | `<id>.lose.<deck slug>`: `flock-tilt.lose.wolf-got-sheep`, `scrap-shove.lose.caught` |
| any other game | the template catalogs (`templates/app/src/i18n/`): every key the Tap Flip templates of the game skills use (rules HUD, counters, continue, lose reason, board summary, win title, tagline, goal, how-to-play, tutorial, pack names), with English, German, Persian and Sorani texts to replace with the game's own | `<id>.lose.<--lose-reason>`, default `<id>.lose.out-of-moves` |

The copy deck's fields map to keys like this:

| Deck field | Catalog key |
|---|---|
| `name`, `tagline`, `goal`, `progress` | `<id>.name`, `<id>.tagline`, `<id>.goal`, `<id>.progress` |
| `winTitle` | `<id>.win-title` |
| `loseReason` | `<id>.lose.<slug>`: `line-siege` → `broke-through`, `flock-tilt` → `wolf-got-sheep`, `scrap-shove` → `caught` (`--lose-reason <slug>` for any other game; default `out-of-moves`) |
| `stats.fooBar` | `<id>.stats.foo-bar` |
| `howToPlay[0]` ... | `<id>.how-to-play.step-1` ... |
| `tutorial[0]` ... | `<id>.tutorial.step-1` ... |
| `packs[0]` ... | `<id>.pack-name.1` ... |

Every way of losing has its own key `<id>.lose.<reason>` (kebab words for what happened). The old spellings `<id>.lose-reason` and `<id>.result.*` are retired; the Shell's fallback for a loss without its own reason stays `result.lose.reason.no-moves`. A string the deck lacks (a second lose reason, an endless HUD line) goes into all four catalogs with its English text written first and fa and ckb marked for native review (the i18n workflow).

`check-game-app.mjs` checks at both stages that every `'<game-id>.*'` key literal in the app's source (the templates copied so far at `--stage scaffold`, all game code at `--stage complete`) exists in all four catalogs (`catalog-missing-key`), so a rules or board template copied with a key the catalogs lack fails before the contract test does.

For a game in the copy deck it also checks that every deck key the catalogs hold carries the deck's text in that language (`deck-text`). The deck is the design's copy of every text, and it changes: on 2026-09-30 the lead reworded Line Siege's march text in all four languages, because the tuned cadence moves the monsters every few blocks, not after every block. `line-siege.how-to-play.step-4` is now "The monsters march closer every few blocks." (de "Alle paar Blöcke rücken die Monster näher.") and `line-siege.tutorial.step-4` "Careful: the monsters march closer every few blocks." (de "Achtung: Alle paar Blöcke rücken die Monster näher."); fa and ckb are drafts for native review. A catalog that kept "After each block you place, the monsters march one row closer." fails `deck-text`. The fix is the deck's text (for the pilot, the canonical Line Siege catalogs carry it); a wish for other words goes to the owner and the deck, never into one catalog.

## An app that already exists: `--add-missing`

`--write` is for a new app: it writes nothing when any planned file already exists with other content (`conflict`). An app that exists but misses scaffold files (an older pilot, a deleted font) is completed with:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/scaffold-game.mjs --app <game-id> --add-missing
```

It writes every absent plan file, never overwrites one, prints `keep <file>` for each existing file with other content (the owner's `game.config.ts`, the 3-line `index.ts`, a grown `package.json`) and exits 0. For the pilot the settings are known; for another game pass the same `--hints`, `--continue` and `--name` as at its scaffold when `game.config.ts` itself is missing. This is the fix `check-game-app.mjs` names for `app-file-missing` and `fonts`. The monorepo bootstrap already writes every pilot file, so on a fresh repo `--add-missing` reports `0 new files`.

## What comes later in `src/`

| Folder | Holds | Skill |
|---|---|---|
| `rules/` | types, create, list-moves, apply-move, outcome, intent-to-move, engine, persistence, stats | game-rules-engine, board-gestures-and-input |
| `levels/` | solver, level plan, LevelsSpec, `pack-<n>.json`, goldens | level-generation-and-solvers |
| `board/` | view, layout, draw, timeline, palettes (`board-palettes.json` and `board-contrast.json`, which check-contrast reads; the palette test needs only `__GAME_ID__`), the board object | board-rendering-skia |
| `sim/` | real-time games only | realtime-game-loop |
| `theme/palette.ts` | the UI palette | toybox-design-system |
| `art/logo-art.ts` | `LOGO_ART`: logo, app icon and splash | code-drawn-art-and-icons |
| `art/game-art.ts` | `GAME_ART` (`presentation.art`): board palettes, `logo: LOGO_ART`, the game's own S11d credits | code-drawn-art-and-icons |
| `sounds/sound-bank.ts` | the sound bank (every sound generated, so no sound credits) | game-audio-and-haptics |
| `tutorial/<id>-teaching.ts`, `index.ts`, `<id>-types.ts`, `contract.test.ts` | teaching, assembly, the types bag, the contract test | game-host-integration |
| `testing/<id>-testing.ts` | bot and example states | game-rules-engine |
