# Component catalogue

Every Toybox component, where its template lives, which reference describes it, and which parts of the design are owned elsewhere or never built. All files sit in `packages/shell/src/ui/` of the app repo. The same list, machine-readable, is `assets/component-catalogue.json` (the checker reads it).

## Contents

1. [Before the components: prerequisites](#before-the-components-prerequisites)
2. [Support files](#support-files)
3. [The 53 components](#the-53-components)
4. [Owned by other work](#owned-by-other-work)
5. [Mock-only parts: never build](#mock-only-parts-never-build)
6. [Which screens use what](#which-screens-use-what)

## Before the components: prerequisites

The components build on modules that ship with the theme and the icon set. `check-components.mjs` fails `prerequisite-missing` when one is absent:

| File | Gives |
|---|---|
| `packages/shell/src/theme/tokens.ts` | `LAYOUT`, `SPACING`, `RADII`, `STROKE`, `ELEVATION`, `MIN_TOUCH`, type roles |
| `packages/shell/src/theme/shell-colors.ts` | `SHELL_COLORS` (gold, cut, toyInk, dangerFill, line, scrim, toast, ad) |
| `packages/shell/src/theme/motion.ts` | `MOTION_MS`, `EASING`, `KEYFRAMES`, `RELEASE_SPRING`, `PRESS_SQUASH` |
| `packages/shell/src/theme/make-styles.ts` | `makeStyles` (themed styles cached per theme) |
| `packages/shell/src/theme/type-styles.ts` | `TYPE_STYLES`, including `rowLabelStrong` (17 Bold, 1.32 / 1.5) for strong and danger rows; an older copy without it fails `prerequisite-missing` |
| `packages/shell/src/ui/app-text.tsx` | `AppText` (variants and tones) |
| `packages/shell/src/ui/raised-surface.tsx` | `RaisedSurface` (the one press implementation); a pushed-in key sits `elevation` lower by layout (`top: elevation`), so the chosen segment and locked tiles measure where the design draws them; an older copy that sinks by a transform fails `prerequisite-missing` |
| `packages/shell/src/ui/toybox-styles.ts` | `hardShadow`, `dieCutRing`, `focusRing` |
| `packages/shell/src/ui/icons/icon.tsx`, `icon-paths.ts` | `Icon` and the 41 icon names (plus the rating-star layers) |

Tests also need the Shell test wrapper: `packages/shell/src/testing/render-with-shell.tsx`, `find-inaccessible-pressables.ts` and `test-palette.ts`.

## Support files

| File | What |
|---|---|
| `component-specs.json` | the as-rendered specs: the numeric projection of the token file's `components` block with CSS borders floored as Chrome renders them and the commented mockup overrides applied; written by `write-component-specs.mjs` |
| `component-specs.ts` | `COMPONENT_SPECS`, the typed import of the JSON |
| `button-paint.ts` | `kindPaint(theme, kind, isDisabled)`: fill, content colour, edge and text tone per button kind |
| `use-hold-to-confirm.ts` | `useHoldToConfirm(onConfirm, frozenProgress?)` and `HOLD_TO_CONFIRM_MS` (2000, `ReduceMotion.Never`; `frozenProgress` holds a static fill for the parity capture), tested by `use-hold-to-confirm.test.ts` |
| `text-metrics.ts` | `lineMetricsOf(family, size)` and `chromeBaseline(family, size, lineHeight)`: where Chrome puts a line's text (rounded hhea ascent and descent of the five Toybox faces), tested by `text-metrics.test.ts` |
| `use-chrome-baseline.ts` | `useChromeBaseline(variant)`: the design's baseline of a type style in the current language (StatList rows), tested by `use-chrome-baseline.test.tsx` |

## The 53 components

| Component | File | Toybox § | Reference | Role | testID prop |
|---|---|---|---|---|---|
| Button (+ hero key) | button.tsx | 4.1, 4.2 | keys-and-inputs.md | button | testID |
| QuietButton | quiet-button.tsx | 4.1 | keys-and-inputs.md | button | testID |
| RowButton | row-button.tsx | 4.3 | keys-and-inputs.md | button | testID |
| KeyButton | key-button.tsx | 4.4 | keys-and-inputs.md | button | testID |
| IconButton | icon-button.tsx | 4.5 | keys-and-inputs.md | button | testID |
| BusyBlocks | busy-blocks.tsx | 4.24 | keys-and-inputs.md | image on the splash, else hidden | optional |
| ToggleKey | toggle-key.tsx | 4.25 | keys-and-inputs.md | switch | testID |
| Toggle | toggle.tsx | 4.6 | keys-and-inputs.md | hidden (the row is the switch) | optional |
| SegmentedControl | segmented-control.tsx | 4.7 | keys-and-inputs.md | radiogroup / radio | testID + segmentTestIDBase |
| Slider | slider.tsx | 4.8 | keys-and-inputs.md | adjustable | testID |
| ProgressBar | progress-bar.tsx | 4.9 | keys-and-inputs.md | progressbar | testID |
| OptionCard | option-card.tsx | 4.10 | keys-and-inputs.md | radio | testID |
| RadioMark | radio-mark.tsx | 4.10 | keys-and-inputs.md | hidden | optional |
| List | list.tsx | 4.11 | lists-and-surfaces.md | none | testID |
| ListGroup | list-group.tsx | 4.11 | lists-and-surfaces.md | none | testID |
| GroupTab | group-tab.tsx | 4.11 | lists-and-surfaces.md | header | testID |
| ListRow | list-row.tsx | 4.11 | lists-and-surfaces.md | button / switch / radio / none | testID |
| SubRow | sub-row.tsx | 4.11 | lists-and-surfaces.md | none | testID |
| IconTile | icon-tile.tsx | 4.12 | lists-and-surfaces.md | hidden | optional |
| Panel | panel.tsx | 4.13 | lists-and-surfaces.md | none | testID |
| PanelHeader | panel-header.tsx | 4.13, 4.28 | lists-and-surfaces.md | header | testID |
| NotePanel | note-panel.tsx | 4.13 | lists-and-surfaces.md | none | testID |
| OfferBox | offer-box.tsx | 4.13 | lists-and-surfaces.md | none | testID |
| Chip | chip.tsx | 4.21 | lists-and-surfaces.md | text | testID |
| Sticker | sticker.tsx | 4.20 | lists-and-surfaces.md | text | testID |
| ArtTile | art-tile.tsx | 4.22 | lists-and-surfaces.md | hidden | optional |
| PremiumArt | premium-art.tsx | 4.22 | lists-and-surfaces.md | hidden | optional |
| Confetti | confetti.tsx | 4.34 | lists-and-surfaces.md | hidden | testID |
| LevelTile | level-tile.tsx | 4.14 | levels-bars-overlays.md | button | testID |
| RatingStar | rating-star.tsx | 4.15 | levels-bars-overlays.md | none | none |
| RatingStars | rating-stars.tsx | 4.15 | levels-bars-overlays.md | image when labelled | optional |
| ResultStars | result-stars.tsx | 4.15 | levels-bars-overlays.md | image | testID |
| TopBar | top-bar.tsx | 4.16 | levels-bars-overlays.md | none | testID |
| BrandLock | brand-lock.tsx | 4.16 | levels-bars-overlays.md | none | testID + nameTestID |
| GameTopBar | game-top-bar.tsx | 4.16 | levels-bars-overlays.md | none | testIDBase |
| BannerBand | banner-band.tsx | 4.17 | levels-bars-overlays.md | none | testID |
| Scrim | scrim.tsx | 4.18 | levels-bars-overlays.md | modal root (`accessibilityViewIsModal`) | testID |
| DialogCard | dialog-card.tsx | 4.18 | levels-bars-overlays.md | none (the Scrim is the modal root) | testIDBase (+ cardTestID) |
| DialogButtonRow | dialog-button-row.tsx | 4.18 | levels-bars-overlays.md | none | testID |
| HoldButton | hold-button.tsx | 4.18 | levels-bars-overlays.md | button + activate action | testID |
| Toast | toast.tsx | 4.19 | levels-bars-overlays.md | alert | testID |
| ToastStack | toast-stack.tsx | 4.19 | levels-bars-overlays.md | none | testID |
| CalendarTile | calendar-tile.tsx | 4.26 | data-displays.md | hidden | testID |
| WeekMark | week-mark.tsx | 4.27 | data-displays.md | image when labelled | optional |
| WeekStrip | week-strip.tsx | 4.27 | data-displays.md | none (marks are images) | testID + dayTestIDBase |
| WeekLegend | week-legend.tsx | 4.27 | data-displays.md | none | testID |
| StatGrid | stat-grid.tsx | 4.28 | data-displays.md | none (cells grouped) | testIDBase |
| StatList | stat-list.tsx | 4.28 | data-displays.md | none | testIDBase |
| ScorePanel | score-panel.tsx | 4.29 | data-displays.md | none | testIDBase |
| WeekBars | week-bars.tsx | 4.29 | data-displays.md | none (bars are images) | testID + barTestIDBase |
| HowToStage | how-to-stage.tsx | 4.30 | data-displays.md | none | testID |
| PagerDots | pager-dots.tsx | 4.30 | data-displays.md | hidden | testID |
| EmptyState | empty-state.tsx | 4.31 | data-displays.md | none | testIDBase |

The parts each one derives from its id are in testids-and-accessibility.md.

## Owned by other work

These appear in the design's component list but ship with the theme or the art set; the checker only confirms the first three exist.

| Part | File | Ships with |
|---|---|---|
| AppText (3.6) | app-text.tsx | the Toybox theme |
| RaisedSurface (3.10) | raised-surface.tsx | the Toybox theme |
| Icon (3.12) | icons/icon.tsx | the icon set |
| LogoTile (4.23) | logo-tile.tsx | the code-drawn art |
| EmptyStatsPicture (4.31 picture) | empty-stats-picture.tsx | the code-drawn art |
| HazardStrip (4.33) | hazard-strip.tsx | the code-drawn art |
| The banner view (`AdBannerSlot`, styled with `useBannerBandStyle()` as `loadedStyle`) | the ads work's banner slot | the ads work |

## Mock-only parts: never build

- **Bottom sheet (4.32):** Google UMP draws the real consent form natively.
- **Board placeholder (4.35):** stands in for the real game board in S6.
- **Ad box, "Ad" chip, "320 × 50" label (4.17):** stand-ins for the creative.

## Which screens use what

| Screen | Components |
|---|---|
| S1 splash | LogoTile, BusyBlocks (splash) |
| S2 language choice | ArtTile, OptionCard, RadioMark, Sticker (Phone language), Button (hero) |
| S3 consent intro | ArtTile, NotePanel, Button (hero) |
| S4 Home | TopBar + BrandLock + IconButton, Sticker (tagline, Premium badge), Button (hero, play cap), Panel (daily card) + IconTile + Button, RowButton (Endless, Premium), KeyButton ×3, the banner band look (useBannerBandStyle on AdBannerSlot) |
| S5 game | GameTopBar (board by the game) |
| S6 pause | Scrim, DialogCard (pause), Button (hero Resume, block buttons), ToggleKey ×3, QuietButton (Home) |
| S7 result | Chip (mode), Sticker (win title), ResultStars, ScorePanel, Button, QuietButton, Panel (reason), OfferBox, LogoTile (lose) |
| S8 levels | TopBar, ProgressBar, RatingStar, LevelTile grid, Panel (locked pack) + IconTile + Sticker (ink), Toast, the banner band look (useBannerBandStyle on AdBannerSlot) |
| S9 daily | TopBar, Panel (today card) + CalendarTile + Chip, Button (hero), Panel (streaks), WeekStrip, WeekLegend |
| S10 statistics | TopBar, Panel + PanelHeader + StatGrid / StatList, WeekBars, Button (danger), NotePanel, EmptyState, the banner band look (useBannerBandStyle on AdBannerSlot) |
| S11 settings | TopBar, ListGroup, ListRow (chevron, toggle, radio, wrap with SegmentedControl), SubRow + Slider, Chip (version) |
| S12 Premium | TopBar, PremiumArt, Button (hero buy, busy), QuietButton (restore), NotePanel (error, pending), Sticker (active), Confetti, Toast / ToastStack |
| S13 how to play | TopBar, HowToStage, Chip (step), PagerDots, Button (previous, next), QuietButton |
| S14 dialogs | Scrim, DialogCard, ArtTile, DialogButtonRow, Button (isInRow), HoldButton |
| S15 debug | TopBar + Sticker (ink badge), HazardStrip, ListRow |
