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
- Apple's tracking rules (App Store guideline 5.1.2(i), App Tracking Transparency; the owner's decision of 2026-09-30): on iOS the app asks the system tracking question before any ad request that could use the device's advertising identifier. The order: where Google's form is required, this intro (its footnote says Google's form opens next), then Google's form; then, on iOS, Apple's system prompt while the player has not answered it yet. When Apple's prompt is the only step due, it appears on its own with the app's usage text, and this intro is not shown (lead decision L10). Declining (or a phone where tracking is restricted) changes nothing on screen: ads still show, without the identifier.

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

**What follows Continue.** "Choose options" opens Google's form where it is required (`showFormIfRequired` on the consent port). When the form has closed, the consent flow calls the port's `requestTracking()` if Google allows ad requests (`canRequestAds`) and the app is active: iOS shows its own tracking dialog only while the status is still undetermined, with the text of the copy-deck key `consent.tracking.usage-description` in the phone's app language ("Google uses this to show you ads that fit your interests. You see ads either way, and the game itself collects no data."), set as the app's `NSUserTrackingUsageDescription` by the config plugin. Only then are ads initialised, so every ad request follows the answer. Apple draws that dialog; the Shell draws nothing for it, and the S3 texts stay exactly as they are. Where Google's form is not required the intro is skipped, and Apple's prompt still comes before the first ad request. admob-ads owns the flow and the port; this screen only calls `onContinue`.

Never asked: with ads mode off (every E2E build), for Premium owners, offline (the moment is retried online), before the tutorial is finished, during a level, and in the held parity frame of `s3-consent-moment`, which asks neither Google nor Apple.

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
- Adding Shell text or a screen for Apple's tracking prompt, or asking it before Google's form closes: iOS draws the prompt, and the consent flow asks after the form, before the first ad request.
