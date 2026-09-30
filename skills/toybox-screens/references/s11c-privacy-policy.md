# S11c Privacy policy

S11c shows the privacy policy as offline text.

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

- The same text as the privacy-policy web page the stores link to, shown offline inside Settings.

## Layout, top to bottom

Top bar "Privacy policy" with Back. Body gap **18** (a tall frame; the body scrolls):

1. Summary panel (row, centred, gap 14): the gold art tile 52 with `shield` + heading 21 "In short: no accounts, and the game itself collects no data."
2. Five sections (column, gap 6 each): heading 21 + paragraph in `prose` (16, line height 1.5 / 1.75): the game, ads, purchase, phone backups, questions.
3. Small print: "Last updated {dateText}".

## States and variants

One state.

## Data the model supplies

`PrivacyPolicyModel` (in `privacy-policy-view.tsx`): `gameName`, `emailText`, `updatedDateText`, `isReducedMotion`, `onBack`.

The template `use-privacy-policy-model.ts` (with its test) builds it: the game's name from the host, the support address from `useGameExtra().links.supportEmail`, and `updatedDateText` = `date.day-month-year` of `PRIVACY_POLICY_UPDATED` (Chosen: 2026-09-27, the day the policy text last changed; change it together with the `privacy.*` texts).

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/settings/privacy/`.

- `packages/shell/src/screens/settings/privacy/privacy-policy-view.tsx`
- `packages/shell/src/screens/settings/privacy/privacy-policy-screen.tsx`
- `packages/shell/src/screens/settings/privacy/privacy-policy-view.test.tsx`
- `packages/shell/src/screens/settings/privacy/use-privacy-policy-model.ts` and its test

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S11c` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `privacy-policy.screen` | ScreenFrame | none |  |  |  |
| `privacy-policy.top-bar` | TopBar | none |  |  | .back-button .title |
| `privacy-policy.summary-card` | Panel | none |  |  |  |
| `privacy-policy.summary-card.art` | ArtTile (gold 52, shield) | none |  |  |  |
| `privacy-policy.summary-card.label` | AppText | header | `privacy.summary` |  |  |
| `privacy-policy.section.game` | View | none |  |  |  |
| `privacy-policy.section.game.title` | AppText | header | `privacy.game.title` |  |  |
| `privacy-policy.section.game.body` | AppText | text | `privacy.game.body` |  |  |
| `privacy-policy.section.ads` | View | none |  |  |  |
| `privacy-policy.section.ads.title` | AppText | header | `privacy.ads.title` |  |  |
| `privacy-policy.section.ads.body` | AppText | text | `privacy.ads.body` |  |  |
| `privacy-policy.section.purchase` | View | none |  |  |  |
| `privacy-policy.section.purchase.title` | AppText | header | `privacy.purchase.title` |  |  |
| `privacy-policy.section.purchase.body` | AppText | text | `privacy.purchase.body` |  |  |
| `privacy-policy.section.backup` | View | none |  |  |  |
| `privacy-policy.section.backup.title` | AppText | header | `privacy.backup.title` |  |  |
| `privacy-policy.section.backup.body` | AppText | text | `privacy.backup.body` |  |  |
| `privacy-policy.section.contact` | View | none |  |  |  |
| `privacy-policy.section.contact.title` | AppText | header | `privacy.contact.title` |  |  |
| `privacy-policy.section.contact.body` | AppText | text | `privacy.contact.body` |  |  |
| `privacy-policy.updated` | AppText | text | `privacy.updated` |  |  |

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `settings.privacy-policy.label` | Privacy policy |
| `privacy.summary` | In short: no accounts, and the game itself collects no data. |
| `privacy.game.title` | The game |
| `privacy.game.body` | {gameName} works offline. There are no accounts and no sign-in. Your progress, statistics and settings are stored only on this phone, and the game itself sends nothing anywhere. |
| `privacy.ads.title` | Ads |
| `privacy.ads.body` | Unless you have Premium, the game shows ads from Google AdMob. When an ad loads, Google may collect data such as device identifiers, approximate location and how you interact with ads, as described in Google’s own privacy policy. Where the law requires it, you are asked first. You can change your choice any time in Settings. |
| `privacy.purchase.title` | Purchase |
| `privacy.purchase.body` | Premium is bought through the App Store or Google Play. Apple or Google handles the payment; the game never sees your payment details. |
| `privacy.backup.title` | Phone backups |
| `privacy.backup.body` | Your phone’s own backup (iCloud or Google) may include your progress. That is your phone’s feature; the game receives nothing. |
| `privacy.contact.title` | Questions |
| `privacy.contact.body` | Write to {emailText}. |
| `privacy.updated` | Last updated {dateText} |

## Reference images

- `assets/reference/s11c-privacy-policy.png` (normal; phone-tall)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- A web view or remote URL: the text is bundled and offline.
- A banner on this screen.
