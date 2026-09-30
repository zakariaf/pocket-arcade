# S1 Splash

S1 covers the load time with the game's logo on the game's ground. The native splash does this on a normal launch; the Shell draws the same picture as `StartupSplash` only while it restarts for a direction change.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- Data the model supplies
- Templates
- testIDs
- Copy keys
- Reference images
- Pitfalls

## What the product requires

- Under 1 second where possible; never waits for the network.
- Loads the save, settings and language, then goes to S2 on first launch, otherwise straight to Home.
- No ad on launch, ever.
- Shows the game's logo (drawn in code) on the game's background colour. The native splash shows the same logo on the same ground, so the hand-off is seamless.

## Layout, top to bottom

No top bar, no banner. The body is centred with gap 0:

1. A column (flex 1, centred, gap 22):
   - logo tile 152 in the splash variant (4 pt edge, 7 pt white ring, tilted -6 deg);
   - the game name in `gameNameSplash` (Lilita One 50 in every language, isolated LTR), 8 pt extra top margin;
   - the tagline in `splashTagline` (18, muted, centred, max width 290).
2. The splash loader (three 14 pt blocks, radius 4, gap 9, hopping) 44 pt above the bottom of the body, labelled `splash.loading.a11y-label` ("Loading {gameName}…").

S1 is one of the few centred screens (with the S7 chip, stars and titles).

## States and variants

One state. Under Reduce motion the loader blocks stand still.

## Data the model supplies

`StartupSplashProps`: `logo` (the game module's `GAME_ART.logo`; `LogoTile` needs it), `gameName` and `tagline` (the module's `identity.nameId` and `identity.taglineId`, the catalog keys `<game-id>.name` and `<game-id>.tagline`, deck keys `games.<id>.name` and `.tagline`), `isReducedMotion`. It has no route. The restart flow (rtl-and-direction's `start-shell.ts`) registers `createStartupSplash({ game, language, restart })` from `app/create-startup-splash.tsx` instead of the app: no save, stores or game host exist before the direction check, so that root brings its own `I18nProvider` (the language startShell resolved, the game's catalogs), a theme from the phone's appearance over the game's palette, and `GameStartupSplash` (`app/game-startup-splash.tsx`), which turns the two ids into text with `gameMessageText`; it calls `restart()` once it has mounted, never while the bundle is still evaluating.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/app/startup-splash.tsx`.

- `packages/shell/src/app/startup-splash.tsx`
- `packages/shell/src/app/startup-splash.test.tsx`
- `packages/shell/src/app/create-startup-splash.tsx`
- `packages/shell/src/app/create-startup-splash.test.tsx`
- `packages/shell/src/app/game-startup-splash.tsx`

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S1` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `splash.screen` | ScreenFrame | none |  |  |  |
| `splash.logo` | LogoTile (152 splash (4 pt edge, 7 pt ring, -6 deg)) | none |  |  |  |
| `splash.game-name` | AppText | header | `games.<id>.name` |  |  |
| `splash.tagline` | AppText | text | `games.<id>.tagline` |  |  |
| `splash.loader` | BusyBlocks (splash loader) | image | a11y `splash.loading.a11y-label` |  |  |

Chosen states the design does not draw may also set: `startup.splash`, `splash.screen`.

## Copy keys

| Key | English |
|---|---|
| `games.<id>.name` | (the game's own text) |
| `games.<id>.tagline` | (the game's own text) |
| `splash.loading.a11y-label` | Loading {gameName}… |

## Reference images

- `assets/reference/s1-splash.png` (normal; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Naming it `startup.splash`: the map's name is `splash.screen` (keep one name).
- Waiting for anything on the network before leaving the splash.
- A text loader ("Loading...") instead of the labelled blocks.
