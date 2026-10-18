# App icon, native splash and store art

## Contents

- What is generated, from what
- Apple's icon requirements
- The Toybox look of each variant (Chosen)
- The render script
- Expo config
- Reviewing the images
- Android and Google Play
- Store art (later)
- What was verified

## What is generated

| Output (in `apps/<game>/assets/generated/`) | Size | Drawn from | Used by |
|---|---|---|---|
| `icon-light.png` | 1024 x 1024, opaque | logo art on the light accent, full bleed | `icon`, `ios.icon.light` |
| `icon-dark.png` | 1024 x 1024, transparent background | the "cut" logo tile (dark accent, toy-ink edge, white ring) | `ios.icon.dark` |
| `icon-tinted.png` | 1024 x 1024, opaque grayscale | the dark tile over the dark ground, through a luma filter | `ios.icon.tinted` |
| `splash-logo.png` | 1024 x 1024 = 200 pt, transparent | the S1 logo tile (152 pt, 4 pt edge, 7 pt ring, -6 degrees), light paint | `expo-splash-screen` |
| `splash-logo-dark.png` | same | same, dark paint | `expo-splash-screen` dark |
| `android-icon-foreground.png` | 1024 x 1024 = 108 dp, transparent | the logo art at 43 %, inside the 66 dp safe circle | `android.adaptiveIcon.foregroundImage` |
| `android-icon-monochrome.png` | same, one white colour on alpha | the same glyph through the MONOCHROME filter (alpha = logo alpha minus luma) | `android.adaptiveIcon.monochromeImage` |
| `android-splash-icon.png` | 1024 x 1024 = 288 dp, transparent | the S1 tile with its ring at 46 %, inside the 192 dp circle, light paint | `expo-splash-screen` `android.image` |
| `android-splash-icon-dark.png` | same | same, dark paint | `expo-splash-screen` `android.dark.image` |
| `play-icon-512.png` | 512 x 512, opaque | the light icon at 512 px | the Play listing (uploaded at Android step 8) |

The list, with each output's size and the Android geometry, is `packages/tooling/src/art/art-outputs.ts` (tested by `art-outputs.test.ts`). The Android outputs are due from Android step 2 (when `packages/shell/src/config/android-config.ts` exists); before that `check-app-art` prints a SKIP line for each.

Next to the PNGs, `render-art.ts` records the game's splash grounds (its palette's light and dark `background`) and its accent (the light `primary`, the adaptive icon's background) in `packages/shell/src/config/splash-grounds.ts`, which the Expo config reads.

Inputs: the game's `LOGO_ART` (`apps/<game>/src/art/logo-art.ts`) and `PALETTE` (`apps/<game>/src/theme/palette.ts`), and the Shell's printed colours. The PNGs are committed. The App Store takes its large icon from the binary's asset catalog; no separate marketing icon is uploaded.

## Apple's icon requirements

| Requirement | Value | Checked by |
|---|---|---|
| Size and shape | 1024 x 1024 px, square, unmasked, sRGB | `check-app-art` (`art-format`) |
| Light | opaque, full-bleed background: Expo flattens transparency onto white | `art-light-opaque` |
| Dark | transparent background, glyph only ("Provide your dark app icon with a transparent background") | `art-dark-clear` |
| Tinted | grayscale ("Provide your tinted app icon as a grayscale image") | `art-tinted-gray` |
| Content | one simple glyph inside the central 62 %; no text, photos, fake gloss or shadows; the system adds its own effects | `art-safe-area` plus a look |
| Sizes | only 1024; Xcode derives every other size | the Expo config |

## The Toybox look of each variant

**Chosen** (the design draws no app icon; these follow the logo tile and the S1 splash so the hand-off from the native splash to S1 is seamless):

- **Light:** the light accent fills the whole square (the tile itself; iOS masks the corners), the logo art at 62 % in the middle.
- **Dark:** the logo tile at 62 % (tile plus ring), untilted, in the "cut" style (toy-ink edge, white die-cut ring) so it reads on the dark backdrop; dark accent and pop.
- **Tinted:** the dark variant over the game's dark ground, converted to grayscale with the Rec. 709 luma matrix.
- **Splash:** the S1 tile at its real proportions: 152 pt of a 200 pt image, 4 pt edge in `border`, 7 pt white ring, -6 degrees; light and dark paints. The splash plugin paints the ground (`PALETTE` light and dark `background`).

`assets/reference/line-siege-app-art.png` shows the five Line Siege outputs at 256 px on a checkerboard (top) and on the dark ground (bottom).

## The render script

`packages/tooling/src/art/render-art.ts` (Node 22.18+, headless Skia):

```sh
node packages/tooling/src/art/render-art.ts --app line-siege           # writes the five PNGs and the splash grounds (~0.4 s)
node packages/tooling/src/art/render-art.ts --app line-siege --check   # exits 1 if a committed PNG or grounds entry is stale
node packages/tooling/src/art/render-art.ts --help                     # usage and exit codes
```

- It imports `@e07/<game>/art/logo-art.ts` and `@e07/<game>/theme/palette.ts`; apps without `"type": "module"` print a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning (hide it with `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`).
- Output is deterministic: re-rendering gives identical bytes, so `--check` belongs in the verify gate. A Skia upgrade can change anti-aliasing bytes: re-render, review and commit.
- Run it after any change to the logo, the palette or the script.
- Exit codes: 0 written or current, 1 stale (`--check` only), 2 bad input. An unknown flag, a missing `--app`, an unknown game, or a game without `logo-art.ts` or `palette.ts` prints one `ERROR: ...` line plus the `--help` pointer and exits 2 (no stack trace). The three art scripts share this handling through `packages/tooling/src/art/art-cli.ts` (tested by `art-cli.test.ts`).

## Expo config

`packages/shell/src/config/art-config.ts` (Node world, read by `app.config.ts` through `withShell`):

- `ICON_CONFIG`: `icon: './assets/generated/icon-light.png'`, `ios.icon: { light, dark, tinted }` with the three PNGs, and `androidLayers: { foregroundImage, monochromeImage }`.
- `splashPlugin({ light, dark, accent })`: `['expo-splash-screen', { image: './assets/generated/splash-logo.png', imageWidth: 200, backgroundColor: light, dark: { image: './assets/generated/splash-logo-dark.png', backgroundColor: dark }, android: { image: './assets/generated/android-splash-icon.png', imageWidth: 288, dark: { image: './assets/generated/android-splash-icon-dark.png' } } }]`. expo-splash-screen 57 merges `android` over the root and `android.dark` over `dark`, so Android keeps the same grounds.
- `withArt(config, ground)`: sets the icons (`android.adaptiveIcon` = the two layers with `backgroundColor: ground.accent`, kept beside the Android block's other keys) and appends the splash plugin to the composed config's one plugin list (never a second list).
- `withGameArt(config, gameId)`: `withArt` with the game's grounds from `splash-grounds.ts`, or the config unchanged while the game has no art yet.
- `splash-grounds.ts` is **generated** by `render-art.ts`: one entry per drawn game, `{ light, dark, accent }` = its palette's `background` (the S1 ground) and light `primary`, keys sorted, formatted as Prettier prints them. The template ships it **empty** (`= {};`): a repo whose game has not been drawn yet configures and prebuilds without `expo-splash-screen`, and `render-art.ts --app <id>` adds the game's entry (it keeps the other games'). `render-art.ts --check` fails when an entry is out of step with the palette.

Wiring, once per repo and once per game, in this order (the order matters: the moment `splash-grounds.ts` lists the game, `withGameArt` adds the `expo-splash-screen` plugin, and `npx expo config` then fails with `Failed to resolve plugin for module "expo-splash-screen"` in any app that lacks the package):

1. **Dependency first:** `expo-splash-screen` (SDK 57: `~57.0.9`) is a native module, so it goes into the Shell's `peerDependencies` (`"*"`) and into every app's `dependencies` at the same version (apps stay in lockstep): run `npx expo install expo-splash-screen` in each app (dependency-management rules).
2. **Per game:** `node packages/tooling/src/art/render-art.ts --app <game>` writes the PNGs and the game's `splash-grounds.ts` entry; look at them (below) and commit both. Do this before the first `npx expo config`, prebuild or simulator build that should show the game's icon and splash (the Shell build order puts it before the first simulator build).
3. **The composer:** `withShell` ends in `return withGameArt(config, game.id);`. architecture-and-boundaries' final `with-shell.ts` template already does (it is the one config composer; `app.config.ts` stays the scaffold's single statement `export default withShell(gameConfig, process.env);`). With an empty `splash-grounds.ts` it adds nothing, so the composer can land before the art does; its test mocks the grounds to prove both cases.
4. **Check:** `cd apps/<game> && npx expo config --type public --json` shows `icon`, `ios.icon` and the `expo-splash-screen` entry with the game's grounds (verified on SDK 57 with this wiring), and `node ${CLAUDE_SKILL_DIR}/scripts/check-app-art.mjs .` prints `RESULT: PASS` (`art-unwired` names a missing piece).

## Reviewing the images

Look at all five with the Read tool at 1024 and downscaled to 256 (`sips -Z 256 in.png --out out.png`): a glyph that reads at 60 px on the Home Screen must read at 256. Put the 256 px versions in the owner report. iOS 26 applies Liquid Glass effects to flat icons and generates the clear appearances itself; check the Home Screen in light, dark and tinted on the simulator once. Icon Composer `.icon` bundles would give per-layer control, but their format is not a documented schema, so v1 ships flat PNGs.

## Android and Google Play

| Requirement | Value | Checked by |
|---|---|---|
| Adaptive icon (Android 8+) | a 108 dp canvas; launchers mask it to a circle, squircle or rounded square and show at least the central 66 dp circle | `art-safe-area` (66/108 circle), `art-adaptive-clear` (transparent layer: the background is `adaptiveIcon.backgroundColor`) |
| Themed icon (Android 13+) | the monochrome layer: one colour, the shape in alpha; the launcher tints it | `art-monochrome` |
| Splash icon (Android 12+) | a 288 dp canvas masked to its central 192 dp circle, on the window background | `art-safe-area` (192/288 circle), `art-splash-clear` |
| Play store icon | 512 x 512, 32-bit PNG, full square (Google applies its own mask and shadow) | `art-format` (512), `art-light-opaque` |
| Wiring | `android.adaptiveIcon` in withArt, the Android splash icon in the splash plugin, an accent in `splash-grounds.ts` | `art-unwired` |

The look: the foreground and monochrome layers carry the logo art alone at 43 % (its square's corners stay inside the 66 dp circle); the accent fills the background as on the light iOS icon. The Android splash shows the S1 tile with its ring at 46 % of the canvas (its corners inside the 192 dp circle), tilted as on S1. `assets/reference/line-siege-android-art.png` shows Line Siege's foreground on its accent, the monochrome layer on two launcher tints, both splash icons on their grounds, each with its safe circle in green, and the Play icon.

## Store art (later)

App Store screenshots are simulator captures (the screenshot matrix). The Play feature graphic (`feature-graphic.png`, 1024 x 500) waits for the store pages (step 8).

## What was verified

On 2026-09-28 in a copy of the monorepo lab: `render-art.ts --app line-siege` wrote the five PNGs, `--check` passed on a re-render, `check-app-art` passed, and the images were inspected at 256 px. The Expo prebuild behaviour above was verified on SDK 57 with the same config shape. Not verified here: how iOS 26 renders these icons with Liquid Glass (check on the simulator's Home Screen).

On 2026-10-12 in a scratch copy of the repo: `render-art.ts --app line-siege` wrote the ten PNGs, `--check` passed on a re-render, `check-app-art` passed, the Android sheet above was inspected, and `tsc`, ESLint, Prettier and the art-config and art-outputs tests passed. expo-splash-screen 57.0.9's `getAndroidSplashConfig` merges `android` over the root config as described. Not verified here: the icons on a real launcher (T13 builds and looks at them on the emulator).
