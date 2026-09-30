# S3 Consent moment

S3 is the Shell's own screen right before Google's consent form; Google draws the form, the Shell only decides when it appears.

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

- Only in regions where consent is required; everyone else never sees it.
- Never before the player has finished the tutorial level; shown before the first ad is ever requested.
- Offline or Premium: skipped; shown later only if an ad is about to load.
- Settings has a permanent "Ad privacy choices" row that reopens the form.
- Not a route: the consent flow (admob-ads) shows this screen full screen, then calls the consent port.

## Layout, top to bottom

No top bar, no banner. Body (gap 14), the two grows centre the text block between the top and the key:

1. grow.
2. Art tile on gold paper with the `shield` icon.
3. Title (`title` 30): "Ad privacy".
4. Lead (`lead` 18).
5. Note panel with the `info` icon: "Ads come from Google. The game itself collects no data."
6. grow.
7. Hero key without a cap, forward icon at the end: "Choose options".
8. Caption (13, muted): the footnote.

**Google's form** (the second frame, `s3-google-s-form`): the same screen under the scrim with Google's sheet on top. Mock only: Google UMP draws the real form natively; never build that sheet.

## States and variants

One state (intro). The google-form frame has no Shell elements.

## Data the model supplies

`ConsentIntroScreenProps`: `onContinue` (opens the form through the consent port), `isReducedMotion`.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/consent/`.

- `packages/shell/src/screens/consent/consent-intro-screen.tsx`
- `packages/shell/src/screens/consent/consent-intro-screen.test.tsx`

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S3` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `consent.screen` | ScreenFrame | none |  | intro |  |
| `consent.art` | ArtTile (gold, shield) | none |  | intro |  |
| `consent.title` | AppText | header | `consent.intro.title` | intro |  |
| `consent.body` | AppText | text | `consent.intro.body` | intro |  |
| `consent.detail-note` | NotePanel | none |  | intro | .icon .label |
| `consent.continue-button` | Button (primary hero, forward icon at the end) | button | `consent.intro.continue-button` | intro |  |
| `consent.footnote` | AppText | text | `consent.intro.footnote` | intro |  |

## Copy keys

| Key | English |
|---|---|
| `consent.intro.title` | Ad privacy |
| `consent.intro.body` | Before the first ad, choose your ad privacy options. |
| `consent.intro.detail` | Ads come from Google. The game itself collects no data. |
| `consent.intro.continue-button` | Choose options |
| `consent.intro.footnote` | Google’s form opens next. You can change your choice any time in Settings. |

## Reference images

- `assets/reference/s3-consent-moment.png` (intro; phone)
- `assets/reference/s3-google-s-form.png` (google-form; mock-only)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Imitating Google's form or pre-ticking anything: the Shell draws only this intro.
- Showing it before the tutorial is finished, or to players who never need it.
