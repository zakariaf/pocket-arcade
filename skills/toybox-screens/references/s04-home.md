# S4 Home

S4 Home is the one-tap start and the door to everything else.

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

- Top bar: game logo and title at the start; Settings (gear) at the end.
- Big Play key: "Continue – Level 12" when a level is in progress, otherwise "Play – Level 13" (the next unfinished level).
- Daily challenge card: today's date (chosen language and digits), "Play today's challenge" or "Done – come back tomorrow", and the current daily streak.
- Row of keys: Levels | Statistics | How to play.
- Premium button with a small crown; hidden once Premium is owned and replaced by a small "Premium" badge by the logo.
- Banner ad at the very bottom only if not Premium AND online AND consent handled; when no banner loads, the space collapses (no empty box).
- Games with an Endless mode show a third mode card: "Endless – Best 4,210".
- Background music, if the game has any, starts here and respects the settings. Returning from a finished level shows updated stars and streak with a short animation (reduced under Reduce motion).

## Layout, top to bottom

**Top bar** (`TopBar` without back): brand lock at the start (logo tile 46 tilted -4 deg, game name in `gameNameHome` 28, and for Premium owners the xs gold "Premium" sticker with a crown, tilt -5 deg); the settings icon button (48, gear, label `common.settings`) at the end.

**Body** (gap 14), in order:

1. Tagline sticker (pop paper, tilt -2 deg, start-aligned): only when the game has **no** Endless mode, or the player owns Premium (there is room then). Its high corner and 3.5 pt die-cut ring rise about 8 pt above its box, into the top bar's area; the body's scroll view would clip them flat, so `HomeView` passes `hasTopOverhang` to `ScreenBody` while the tagline shows (the clip edge moves 10 pt up, nothing else moves).
2. Hero key with a `play` cap: `home.play-button.continue` or `home.play-button.play`.
3. Daily panel (flat, padding 14 / 14 / 16, gap 12): header row (gap 12, top-aligned) of the `calendar` icon tile → text column (heading 21 "Daily challenge", the date muted, **title/date gap 1**: the reference puts the date 1 pt under the title; a gap of 2 pushed every block below it down 1.5 pt) → small gold streak sticker (chain, tilt +4 deg, 2 pt top margin); then a secondary block button with a `play` icon. Once today is played, the button becomes a row with a 20 pt success check and "Done – come back tomorrow" (`home.daily-card.done`, Chosen).
4. Endless row button (only games with Endless): secondary, accent icon tile `endless`, label with the best score, description, chevron.
5. Home keys: three secondary keys (94 tall, icon 30, label 15 Bold) in three columns with gap 10: Levels (`grid`), Statistics (`stats`), How to play (`book`). They stack at 200 % text.
6. Premium row button (pop, gold icon tile `crown`, "Premium" / "Remove ads", chevron); not for owners.
7. Banner slot, pinned under the scrolling body (not for owners).

## States and variants

- **Normal** (`s4-home.png`): Line Siege has Endless, so the tagline is hidden.
- **Premium** (`s4-home-premium.png`): badge under the name, tagline shown, no Premium key, no banner.
- **Daily done** (Chosen, not drawn): the done line replaces the daily play button.
- A new player sees "Play – Level 1".
- Open question (from the map): which element opens S9 from Home. The design's daily panel is flat and its only button plays today's challenge; the template adds no extra target. Ask the owner before adding one; a new target needs a new map testID.

## Data the model supplies

`HomeModel` (`home-model.ts`), built by the template `use-home-model.ts` (copy it with `use-home-actions.ts`, `use-level-play.ts` and `use-home-model.test.tsx`). Every input and where it comes from:

| Field | Source |
|---|---|
| `logo` | `useGameHost().logo` (the module's `GAME_ART.logo`; `LogoTile` needs it) |
| `gameName`, `tagline` | `gameMessageText(t, { id: host.nameId })` and `{ id: host.taglineId }` |
| `hasEndless` | `useGameExtra().modes.endless` (`app/use-game-extra.ts`: `expo.extra.game`, read once) |
| `isPremium` | the premium store (`state.isPremium`) |
| `isReducedMotion` | `useReduceMotion()` |
| `play` (`isContinue`, `level`) | `useLevelPlay()`: the saved run `save.doc().run?.ref` when its kind is `'level'` ("Continue – Level 12"; the game host writes a new run at once), else `selectNextLevel(state, levelCountOf(useGameExtra()))` ("Play – Level 13"); daily and endless runs are not offered here |
| `daily` | `useDailySummary()` (daily-and-statistics): `dateText` = `formatWeekdayDayMonth(today, t)`, `streakDays` = current streak, `isDoneToday` |
| `bestEndlessScore` | the progress store (`selectEndlessBest`) |
| `banner` | `useBannerSlot('home')` (admob-ads' `app/use-ad-context.ts`): the ads port's `renderBanner` and `shouldShowBanner(config, useAdContext('home'), 'home')`, where the context is Premium, `useIsOnline()`, the saved consent answer, the tutorial done and the levels won |
| (cold start) | not a field: `useColdStartMark(useOptionalDebugServices()?.perfLog ?? null)` (performance-budgets' `app/perf/use-cold-start-mark.ts`) marks Home's first frame with real data into a test build's perf log, which the E2E evidence run reads; store builds have no debug services and pass null, so nothing is measured or stored |
| (parity) | not a field: a parity capture of `s14-progress-restored` opens `{ kind: 'save-restored' }` over Home once (`useParityOpener`, the dialog host's `useOpenDialog()`) |
| `actions` | `useHomeActions(onPlay, today)`: exactly navigation-and-routing's table (Game with `{ start: 'resume' }` or a new level, daily or endless run; Settings, Levels, Stats, HowToPlay, Premium). In a partial Shell a route outside the slice shows `NotBuiltScreen`; never write a no-op handler | `HomeTopBar` puts the Toybox `BrandLock` (`testID="home.brand-lock"`, `nameTestID="home.game-name"`, the `LogoTile` as `logo`, the Premium sticker as `badge`) at the start of the `TopBar`.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/home/`.

- `packages/shell/src/screens/home/home-model.ts`
- `packages/shell/src/screens/home/use-home-model.ts`, `use-home-actions.ts`, `use-level-play.ts` and `use-home-model.test.tsx`
- `packages/shell/src/app/use-game-extra.ts`, `use-is-online.ts`, `use-parity-opener.ts` (with tests), admob-ads' `app/use-ad-context.ts`, performance-budgets' `app/perf/use-cold-start-mark.ts` and e2e-maestro's `app/debug-services-context.tsx` (the perf log arrives on `DebugServices.perfLog`)
- `packages/shell/src/screens/home/home-daily-card.tsx`
- `packages/shell/src/screens/home/home-keys.tsx`
- `packages/shell/src/screens/home/home-top-bar.tsx`
- `packages/shell/src/screens/home/home-view.tsx`
- `packages/shell/src/screens/home/home-screen.tsx`
- `packages/shell/src/screens/home/home-view.test.tsx`

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S4` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `home.screen` | ScreenFrame | none |  |  |  |
| `home.top-bar` | TopBar (brand lock, no back button) | none |  |  |  |
| `home.brand-lock` | BrandLock | none |  |  |  |
| `home.logo` | LogoTile (46) | none |  |  |  |
| `home.game-name` | AppText | header | `games.<id>.name` |  |  |
| `home.premium-badge` | Sticker (gold xs, crown, -5 deg) | text | `home.premium-badge.label` | premium |  |
| `home.settings-button` | IconButton (gear) | button | a11y `common.settings` |  |  |
| `home.tagline` | Sticker (pop, -2 deg) | text | `games.<id>.tagline` |  |  |
| `home.play-button` | Button (primary hero, play cap) | button | `home.play-button.continue` |  |  |
| `home.daily-card` | Panel (daily panel) | none |  |  |  |
| `home.daily-card.icon` | IconTile (pop, calendar) | none |  |  |  |
| `home.daily-card.title` | AppText | header | `daily.title` |  |  |
| `home.daily-card.date` | AppText | text | `date.weekday-day-month` |  |  |
| `home.daily-card.streak` | Sticker (gold sm, chain, +4 deg) | text | `daily.streak.count` |  |  |
| `home.daily-card.play-button` | Button (secondary block, play icon) | button | `daily.today.play-button` |  |  |
| `home.endless-card` | RowButton (secondary) | button |  | endless | .icon .label .description |
| `home.levels-button` | KeyButton (grid) | button | `common.levels` |  |  |
| `home.stats-button` | KeyButton (stats) | button | `common.statistics` |  |  |
| `home.how-to-play-button` | KeyButton (book) | button | `common.how-to-play` |  |  |
| `home.premium-button` | RowButton (pop) | button |  | normal | .icon .label .description |
| `home.banner-ad` | AdBannerSlot | none |  | normal |  |

Chosen states the design does not draw may also set: `home.daily-card.done`, `home.daily-card.play-button`.

## Copy keys

| Key | English |
|---|---|
| `games.<id>.name` | (the game's own text) |
| `home.premium-badge.label` | Premium |
| `common.settings` | Settings |
| `games.<id>.tagline` | (the game's own text) |
| `home.play-button.continue` | Continue – Level {level, number} |
| `daily.title` | Daily challenge |
| `date.weekday-day-month` | {weekdayName}, {day, number} {monthName} |
| `daily.streak.count` | {daysCount, plural, =0 {No streak yet} one {# day streak} other {# day streak}} |
| `daily.today.play-button` | Play today’s challenge |
| `home.endless-card.label` | Endless – Best {bestScore, number} |
| `home.endless-card.description` | Play until you lose, then beat your best. |
| `common.levels` | Levels |
| `common.statistics` | Statistics |
| `common.how-to-play` | How to play |
| `home.premium-button.label` | Premium |
| `home.premium-button.hint` | Remove ads |

## Reference images

- `assets/reference/s4-home.png` (normal; phone)
- `assets/reference/s4-home-premium.png` (premium; phone)
- `assets/reference/s4-home-dark-en.png` (dark theme) and `assets/reference/s4-home-light-fa.png` (Persian, right to left): how the same screen looks in dark and mirrored.

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Leaving an empty box where the banner failed to load: the slot has zero height until an ad loads.
- Showing the banner or the Premium key to owners.
- Making the whole daily panel pressable: panels lie flat; put a button in them.
- Two hero keys (the daily button is a 54 pt secondary block, not a hero).
- A tilted tagline clipped flat at the top of the body: pass `hasTopOverhang` while it shows.
- A title/date gap of 2 in the daily panel (the reference uses 1).
