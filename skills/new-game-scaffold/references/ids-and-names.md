# Ids and names of a game

Every identifier a new game gets, where it is used, and the one form each takes. Most come from the game id; a few are the owner's.

## Contents

- The game id and its forms
- Owner-approved identifiers
- Placeholders the scaffold writes
- Identifiers inside the game
- Files and names outside the app

## The game id and its forms

The game id is kebab-case, lowercase ASCII words joined by hyphens, taken from the catalogue (spec 13): `line-siege`, `flock-tilt`, `scrap-shove`, `snare-snake`, `dig-site`, `bank-shot`, `halo-drift` and so on. It never changes after the first release (it is inside every save).

| Form | Example | Used for |
|---|---|---|
| kebab (the id) | `flock-tilt` | folder `apps/flock-tilt`, package `@e07/flock-tilt`, `GameConfig.id`, `identity.id`, the save's `gameId`, catalog key prefix `flock-tilt.`, level plan `gameId`, file names `flock-tilt-types.ts` |
| Pascal | `FlockTilt` | types: `FlockTiltState`, `FlockTiltMove`, `FlockTiltEvent`, `FlockTiltTypes` |
| camel | `flockTilt` | the module export `flockTiltGame`, the board object `flockTiltBoard` |
| UPPER_SNAKE | `FLOCK_TILT` | module-level constants: `FLOCK_TILT_ENGINE`, `FLOCK_TILT_RULES`, `FLOCK_TILT_LEVELS`, `FLOCK_TILT_PERSISTENCE` |

Templates of the game skills use `__GAME_ID__`, `__GAME_PASCAL__`, `__GAME_CAMEL__` and `__GAME_CONST__` for these four forms; `check-game-app.mjs` fails (`placeholder-left`) on any of the templates' own placeholder names left in the app (these four, `__BUNDLE_ID__`, the `game.config.ts` settings such as `__HINTS_FREE_PER_DAY__`, `__LOSE_SLUG__`, `__PIECE_COLOR_<n>__` and the other per-game values). Platform identifiers such as `__DEV__`, `__OBJC__` or `__LINE__` are not placeholders, and the generated `ios/`, `android/`, `build/` and `out/` folders, Pods and `node_modules` are never scanned (after the first simulator build they hold hundreds of them).

## Owner-approved identifiers

| Identifier | Format | Step |
|---|---|---|
| App name per language | Latin by default in all four languages | G1 |
| Bundle id | `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`, same on iOS and Android, one app record | G1 |
| App Store id | numeric string, `null` until the record exists | G2 |
| Premium product id | `<bundleId>.premium`, one non-consumable per game | G4 / P1 |
| AdMob app id | `ca-app-pub-<16 digits>~<10 digits>` | G5 |
| AdMob unit ids | `ca-app-pub-<16 digits>/<10 digits>` for banner, interstitial, rewarded | G5 |

## Placeholders the scaffold writes

- Bundle id `com.example.<id-without-hyphens>` when `--bundle-id` is not given. Fine for simulator work; `check-game-app.mjs --stage complete` fails until the owner's id is in.
- AdMob ids in the documented format with dummy digits. They are never used in test builds (`ADS_MODE=test` picks Google's test ids); a live build needs the real ones.
- Privacy link `example.com/<id>/privacy` and `support@example.com`: replaced with the owner's before release.

## Identifiers inside the game

| Identifier | Rule | Example |
|---|---|---|
| Catalog keys | `<id>.<area>.<element>`, 2 to 5 kebab segments | `flock-tilt.lose.wolf-got-sheep`, `flock-tilt.hud.moves` |
| Lose reason keys | `<id>.lose.<reason>` | `tap-flip.lose.out-of-moves` |
| Pack ids | kebab-case, per pack | `green-meadow` (name key `flock-tilt.pack-name.1`) |
| Counter ids | kebab-case, permanent (save keys) | `sheep-penned`, label `flock-tilt.stats.sheep-penned` |
| Event kinds | past-tense kebab-case | `sheep-penned`, `field-tilted` |
| Daily salt | a 16-bit number fixed forever | the scaffold prints a suggestion (FNV-1a of the id folded to 16 bits) |
| Test ids on screens | `<screen>.<element>` (Shell) | `game.board`, `result.next-button` |

## Files and names outside the app

| Thing | Name |
|---|---|
| Board pixel goldens | `test/goldens/boards/<id>-board.golden.test.ts` |
| Bot simulations | `test/sims/<id>/<name>.sim.test.ts` |
| E2E flows | `apps/<id>/e2e/flows/<area>/<nn>-<name>.yaml`, game flows numbered 10 and up |
| Commit scope | `feat(<id>): ...` |
| Release tags | `<id>/v<version>+<build>` per upload, `<id>/v<version>` when shipped |
| Simulators | created by name, `e07-<purpose>` |
