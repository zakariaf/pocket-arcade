---
name: code-drawn-art-and-icons
description: Draws Pocket Arcade art in code - 41 Toybox icons, Icon, game logos, GAME_ART and credits, LogoTile, app icon and splash via headless Skia. Use when adding an icon, logo, app icon or splash, or an image or emoji appears. Not for colours (toybox-design-system) or boards (board-rendering-skia).
---

# Code-drawn art and icons

Makes every picture in a Pocket Arcade app come from code: the Shell's 41 Toybox icons as one Skia path each, each game's logo as 48-grid layers handed to the Shell in `GAME_ART` (with its board palettes and licence credits), the Shell pictures, and the app icon and splash rendered by headless Skia from the same logo and palette. Scripts prove the icon set, the logos, `GAME_ART` and the generated PNGs, and ban image files, emoji and icon fonts.

## Rules that must hold

1. **Every UI icon is a Toybox glyph from `icon-paths.ts`, drawn by `<Icon>`.** Never react-native-svg, emoji, icon fonts or image files: the owner's rule is "drawn in code", react-native-svg adds a network-capable native pod, and one rasterized path per icon was measured 4.8x faster than a canvas per icon.
2. **`icon-paths.ts` is generated from `icon-layers.json` by `build-icon-paths.ts`, never edited by hand.** The layers are the design's source; a hand-edited path drifts from it silently (`check-icons-and-logos` compares every path with its layers).
3. **Only `back`, `chevron`, `forward` and `undo` mirror in RTL.** `Icon` flips them itself; play, pause, clocks, stars, the lock, logos and pictures never mirror.
4. **Every game has a `LOGO_ART` on the 48 grid using the six roles** (`p`, `w`, `w0`, `k`, `kl`, `pl`); Line Siege, Flock Tilt and Scrap Shove use their Toybox logos exactly. The logo is the brand on Home, About, the lose screen, the splash and the app icon.
5. **This skill owns the art contract:** `packages/shell/src/art/game-art.ts` (`GameArt` = `palettes`, `logo`, `credits`), `credit-entry.ts` and `credit-rows.ts`; each game's `GAME_ART` sets `logo: LOGO_ART` from `./logo-art.ts` and lists only its own credits. There is no `drawIcon`: every picture of the game draws `LOGO_ART`. Why: one data file is the whole brand, and the Shell reaches the logo and the licence rows only through the module.
6. **Multi-colour art is one Skia canvas, at most 8 per screen outside the board, never one per list item.** Each canvas costs about 0.18 MB and 2.8 ms; draw code imports Skia types only and takes the Skia API as a parameter so the same code runs in the app, goldens and Node.
7. **The app icon and splash come from `render-art.ts` and are committed.** 1024 x 1024; light opaque and full bleed; dark with a transparent background; tinted opaque grayscale; glyph inside the central 62 %; splash = the S1 logo tile. `--check` keeps them in step with the logo and palette.
8. **A star rating is two stacked icons, `rating-fill` in `starOn` plus `rating-edge` in `border`** (hollow: only `rating-edge` in `starOff`); `star-filled` / `star-outline` are single-colour glyphs for tiles and rows.
9. **Look at every generated image before committing.** The icon contact sheet, and the five app PNGs at 1024 and 256 px: a check that the file is valid is not a check that it looks right.
10. **Board sprites are pre-rendered once per key** (palette, scheme, colour-blind, cell size, pixel ratio), never redrawn per frame.

## Workflow

1. Read [references/icon-system.md](references/icon-system.md) first: the decision, the layer model, the build pipeline, `Icon`, sizes, tests.
2. **Setting up (once).** Copy from `templates/`: `packages/tooling/src/art/` (icon-layers.json, build-icon-paths.ts, render-icon-sheet.ts, render-art.ts, art-cli.ts and its test), `packages/tooling/src/visual/load-headless-skia.ts`, `packages/shell/src/ui/icons/` (icon-paths.ts, icon-raster.ts, icon.tsx and both tests), `packages/shell/src/art/` (logo, drawing, pictures, `game-art.ts`, `credit-entry.ts`, `credit-rows.ts`, tests), `packages/shell/src/ui/` (logo-tile, picture-path, empty-stats-picture, hazard-strip and their tests), `packages/shell/src/game-host/sprite-cache*.ts` and `packages/shell/src/config/` (art-config, its test, splash-grounds). Then, in the same change, uncomment the three `jest.mock('@e07/shell/ui/icons/icon-raster.ts', ...)` lines in the root `jest.setup.ts` (they ship commented out because a mock of a missing module fails every suite; icon-system.md, "Tests"); `check-icons-and-logos.mjs` fails `icon-raster-mock` until you do. `splash-grounds.ts` ships empty on purpose (step 7 fills it). Every art script prints its usage with `--help` and exits 2 with one `ERROR:` line on a bad flag.
3. **Using an icon.** Pick the name in [references/icon-catalogue.md](references/icon-catalogue.md), the size from icon-system.md ("Sizes per component"), the colour from the theme; the surrounding button or row carries the label.
4. **Adding or changing an icon.** Follow icon-system.md ("Adding or changing an icon"): layers into `icon-layers.json`, `node packages/tooling/src/art/build-icon-paths.ts`, `node packages/tooling/src/art/render-icon-sheet.ts`, then look at the sheet next to [assets/reference/icons-design.png](assets/reference/icons-design.png).
5. **A game's logo and GAME_ART.** Read [references/logos-and-pictures.md](references/logos-and-pictures.md). Painted games: copy `templates/apps/line-siege/src/art/logo-art.ts`, [examples/flock-tilt-logo-art.ts](examples/flock-tilt-logo-art.ts) or [examples/scrap-shove-logo-art.ts](examples/scrap-shove-logo-art.ts) to `apps/<game>/src/art/logo-art.ts`. A new game: design one with "Designing a logo for a new game" and compare its look with [assets/reference/logos-design.png](assets/reference/logos-design.png). Show a new logo to the owner. Then copy `templates/apps/__GAME_ID__/src/art/game-art.ts` to `apps/<game>/src/art/game-art.ts`, replace `__GAME_ID__`, run `npx eslint --fix` on it (the import order depends on the game id), and add a `CreditEntry` for every font or word list the game ships beyond the Shell's ("GAME_ART" in logos-and-pictures.md); the game-host-integration skill assembles it as `presentation.art`.
6. **Shell pictures.** `LogoTile` (five variants), `EmptyStatsPicture` (S10) and `HazardStrip` (S15) are in the templates; their specs are in logos-and-pictures.md.
7. **App icon and splash** (before the first simulator build). Read [references/app-icon-and-splash.md](references/app-icon-and-splash.md), "Expo config", and keep its order: first `npx expo install expo-splash-screen` in every app (and `"expo-splash-screen": "*"` in the Shell's `peerDependencies`), then, with the game's `LOGO_ART` and palette (`apps/<game>/src/theme/palette.ts`) in place, `node packages/tooling/src/art/render-art.ts --app <game>` (it writes the five PNGs and adds the game to `splash-grounds.ts`). Look at the PNGs at 1024 and 256 px (compare with [assets/reference/line-siege-app-art.png](assets/reference/line-siege-app-art.png)). `withShell` ends in `withGameArt(config, game.id)` (architecture-and-boundaries' final `with-shell.ts`; never edit `app.config.ts`). Only then run `npx expo config`, prebuild or a build; commit the PNGs and `splash-grounds.ts`.
8. **Sprites or Skia questions** (headless loading, Jest projects, fonts in Skia): [references/skia-notes.md](references/skia-notes.md).
9. **Run the checks from the repo root** and loop until all pass: `npx tsc --noEmit` for the touched projects, `npx eslint <changed paths> --max-warnings 0`, `npx jest packages/shell/src/art packages/shell/src/ui packages/shell/src/config packages/tooling/src/art apps/<game>/src/art --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/{art,config}/**/*.ts' --coverageThreshold='{}'` (only `npm run test:coverage` judges the thresholds) and `npx jest packages/shell/src/art packages/shell/src/ui packages/shell/src/game-host/sprite-cache.golden.test.ts --ci --selectProjects golden` (paths first: `--selectProjects` reads every later word as a project name), `node packages/tooling/src/art/build-icon-paths.ts --check`, `node packages/tooling/src/art/render-art.ts --app <game> --check`, then the two scripts below.
10. **Report** what was drawn or changed, with the 256 px images, and say plainly that the owner should look at any new logo or icon.

## Definition of done

- [ ] `icon-paths.ts` was generated from `icon-layers.json` (`build-icon-paths.ts --check` exits 0) and its contact sheet was looked at.
- [ ] Every game with `src/` has a valid `src/art/logo-art.ts`; painted games match their Toybox logos; every assembled game has `src/art/game-art.ts` with `logo: LOGO_ART` and its own credits.
- [ ] Every Expo app has the five generated PNGs, `render-art.ts --check` exits 0, they were looked at at 1024 and 256 px, its splash grounds are in `packages/shell/src/config/splash-grounds.ts`, `withShell` ends in `withGameArt`, and the app depends on `expo-splash-screen`.
- [ ] No image file, image import, emoji, icon font or react-native-svg in app source.
- [ ] Once `icon-raster.ts` exists, the root `jest.setup.ts` mocks it (the unit project cannot load Skia).
- [ ] Unit and golden Jest projects, `tsc` and ESLint (`--max-warnings 0`) pass for the touched code.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-app-art.mjs .` prints `RESULT: PASS` (when an Expo app exists)
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-icons-and-logos.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Editing a path in `icon-paths.ts` to "fix" an icon.** The next generation overwrites it and the checker flags it as stale; change the layers and regenerate.
- **An emoji or a PNG "just for now".** It ships, it breaks the drawn-in-code rule and the look; use an `Icon` or a picture op.
- **A Skia canvas per level tile or row.** Measured 4 to 5 times slower to lay out; rasterized icons in native images scale to hundreds.
- **Mirroring the logo or the play icon in RTL.** Objects and media controls keep their direction; only arrows that point along the reading direction flip.
- **Committing icons or splash images without looking at them.** Valid PNGs can still be blank, clipped or off-centre; open them.
- **Importing Skia values in shared draw code.** Node scripts then load React Native and fail; import types and take the API as a parameter.
- **Drawing the app icon from a screenshot of the app.** Render it from `LOGO_ART` and the palette so the icon, splash and in-app logo stay one design.
- **A second drawing of the logo for one screen** (a `drawIcon` painter, a PNG for the result screen). Screens get `host.logo` (the module's `GAME_ART.logo`) and draw it with `LogoTile`.
- **Listing the Shell's fonts or generated sounds in a game's credits.** The Shell's rows already cover them; a duplicate row confuses the licences screen.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/icon-system.md](references/icon-system.md) | Why rasterized paths, the layer model, build pipeline, Icon, sizes, mirroring, tests, adding an icon | Workflow step 1 |
| [references/icon-catalogue.md](references/icon-catalogue.md) | All 41 icons with names, use, mirroring and layers; the rating-star layers | Picking or changing an icon |
| [references/logos-and-pictures.md](references/logos-and-pictures.md) | Logo grid and roles, the three logos, new-logo recipe, logo tile variants, rating star, empty picture, hazard strip | Logos and Shell pictures |
| [references/app-icon-and-splash.md](references/app-icon-and-splash.md) | Outputs, Apple rules, the Toybox look of each variant, render-art, Expo config, review | App icon, splash, store art |
| [references/skia-notes.md](references/skia-notes.md) | Where Skia runs, headless loading, APIs, declarative drawing, Jest projects, fonts, sprites | Any Skia question |
| `templates/packages/tooling/src/art/` | icon-layers.json, build-icon-paths.ts, render-icon-sheet.ts, render-art.ts, art-cli.ts (`--help`, bad-flag errors, exit codes) and its test | Workflow steps 2, 4, 7 |
| `templates/packages/tooling/src/visual/load-headless-skia.ts` | Headless Skia loader for Node scripts | Workflow step 2 |
| `templates/packages/shell/src/ui/icons/` | icon-paths.ts (generated, 44 entries), icon-raster.ts, icon.tsx, icon.test.tsx, icon-raster.golden.test.ts | Workflow step 2 |
| `templates/packages/shell/src/art/` | logo-art.ts, draw-logo.ts, picture-ops.ts, game-art.ts (`GameArt`), credit-entry.ts, credit-rows.ts (`creditRowsOf`) and their tests (unit and golden) | Workflow steps 2, 5, 6 |
| `templates/packages/shell/src/ui/` | logo-tile, picture-path, empty-stats-picture, hazard-strip (with tests) | Workflow step 6 |
| `templates/packages/shell/src/game-host/` | sprite-cache.ts and its golden test | Sprites |
| `templates/packages/shell/src/config/` | `art-config.ts` (`ICON_CONFIG`, `splashPlugin()`, `withArt()`, `withGameArt()`), its test, and `splash-grounds.ts` (ships empty; `render-art.ts` adds each drawn game) | Workflow steps 2 and 7 |
| `templates/apps/line-siege/src/art/logo-art.ts` | Line Siege's LOGO_ART | Workflow step 5 |
| `templates/apps/__GAME_ID__/src/art/game-art.ts` | A game's `GAME_ART` (palettes, `logo: LOGO_ART`, credits) | Workflow step 5 |
| [examples/flock-tilt-logo-art.ts](examples/flock-tilt-logo-art.ts) | Flock Tilt's LOGO_ART (rotated layers) | Workflow step 5 |
| [examples/scrap-shove-logo-art.ts](examples/scrap-shove-logo-art.ts) | Scrap Shove's LOGO_ART | Workflow step 5 |
| [assets/reference/icons-design.png](assets/reference/icons-design.png) | The 44 icons as the design draws them (ICON_PATHS order, 8 per row) | Reviewing icons |
| [assets/reference/logos-design.png](assets/reference/logos-design.png) | The three S1 logo tiles, light and dark, as the design draws them | Reviewing logos |
| [assets/reference/line-siege-app-art.png](assets/reference/line-siege-app-art.png) | The five generated Line Siege PNGs at 256 px | Reviewing app art |
| `assets/toybox-tokens.json` | The Toybox token file (icons, logos, component sizes) | Read by the scripts |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `scripts/check-icons-and-logos.mjs` | Checker: icon set, paths vs layers, directional set, logos, `GAME_ART.logo`, LogoTile numbers vs tokens, image/emoji/svg bans, the icon-raster mock in `jest.setup.ts` | Workflow steps 2 and 9 |
| `scripts/check-app-art.mjs` | Checker: the five generated PNGs per app (size, alpha, grayscale, safe area) and the wiring (`withGameArt` in the Shell config, splash grounds, `expo-splash-screen`) | Workflow step 9 |
| `scripts/lib/` | SVG path reader, icon coverage sampler (a path vs its layers), PNG reader, Toybox art expectations (used by the scripts) | Never directly |
| `scripts/selftest.mjs` | Proves both checkers on good and planted-bad fixtures | After changing a checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test | When adding a rule |

## Related skills

- `toybox-design-system` - the palettes, printed colours and fonts the art uses.
- `toybox-components` - the components that place icons, stars and logo tiles.
- `game-host-integration` - assembles `GAME_ART` as `presentation.art` and hands `logo` and `credits` to screens.
- `toybox-screens` - the Result, Home, About and Licences screens that draw the logo and list the credits.
- `board-rendering-skia` - board pictures, timelines and pixel goldens.
- `toybox-visual-parity` - compares built screens with the design screenshots.
- `ios-release-testflight` - the build that carries the icon and splash.
