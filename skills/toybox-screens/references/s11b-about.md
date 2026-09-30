# S11b About and credits

S11b About and credits names the game, its version, how it was made and where to get help.

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

- About and credits: game name, version, "Made with Claude Code", support e-mail.

## Layout, top to bottom

Top bar "About and credits" with Back. Body (gap 14):

1. Header row (centred, gap 20, padding 6 / 0 / 4): the cut logo tile 92 (toy-ink edge, 5 pt white ring) → column (start-aligned, gap 6): game name (`gameNameAbout` 34), tagline (muted), version chip "Version 1.0.0 (8)".
2. A list of three facts without chevrons: `hint` "Made with Claude Code", `wifi-off` "Works fully offline. No account needed.", `music` "All art is drawn in code…".
3. A panel (column, gap 6): heading 21 "Support" + "Questions or ideas? Write to {emailText}."
4. A list: Contact support (`mail`) and Licences (`doc`), each with a chevron.

## States and variants

One state.

## Data the model supplies

`AboutModel` (in `about-view.tsx`): `logo` (`useGameHost().logo`; `LogoTile` needs it), `gameName` and `tagline` (`gameMessageText(t, { id: host.nameId })` and `{ id: host.taglineId }`), `versionText`, `emailText`, `isReducedMotion`, `onBack`, `onContact` (the mail app, no network), `onOpenLicences`. Both lists have no tab, so they are the Toybox `List` (not `ListGroup`); fact rows have no `end`, the two link rows `end="chevron"`.

The template `use-about-model.ts` (with its test) builds it: `versionText` from `readVersionText()` ("1.0.0 (8)": expo-constants' version and `ios.buildNumber`), `emailText` from `useGameExtra().links.supportEmail`, `onContact` from `useSettingsLinks(versionText)` (the mail app with the address and the version), `onOpenLicences` = `navigate('Licences')`.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/settings/about/`.

- `packages/shell/src/screens/settings/about/about-facts.tsx`
- `packages/shell/src/screens/settings/about/about-view.tsx`
- `packages/shell/src/screens/settings/about/about-screen.tsx`
- `packages/shell/src/screens/settings/about/about-view.test.tsx`
- `packages/shell/src/screens/settings/about/use-about-model.ts` and its test

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S11b` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `about.screen` | ScreenFrame | none |  |  |  |
| `about.top-bar` | TopBar | none |  |  | .back-button .title |
| `about.header` | View | none |  |  |  |
| `about.logo` | LogoTile (92 cut (toy-ink edge, 5 pt ring)) | none |  |  |  |
| `about.game-name` | AppText | header | `games.<id>.name` |  |  |
| `about.tagline` | AppText | text | `games.<id>.tagline` |  |  |
| `about.version-chip` | Chip | text | `about.version` |  |  |
| `about.facts-list` | ListGroup | none |  |  |  |
| `about.made-with-row` | ListRow | none |  |  | .icon .label |
| `about.offline-row` | ListRow | none |  |  | .icon .label |
| `about.art-sound-row` | ListRow | none |  |  | .icon .label |
| `about.support-card` | Panel | none |  |  |  |
| `about.support-card.title` | AppText | header | `about.support.label` |  |  |
| `about.support-card.body` | AppText | text | `about.support.body` |  |  |
| `about.links-list` | ListGroup | none |  |  |  |
| `about.contact-row` | ListRow | button |  |  | .icon .label |
| `about.licences-row` | ListRow | button |  |  | .icon .label |

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `settings.about.label` | About and credits |
| `games.<id>.name` | (the game's own text) |
| `games.<id>.tagline` | (the game's own text) |
| `about.version` | Version {versionText} |
| `about.made-with` | Made with Claude Code |
| `about.offline` | Works fully offline. No account needed. |
| `about.art-sound` | All art is drawn in code. Sounds are generated or come from public-domain sources. |
| `about.support.label` | Support |
| `about.support.body` | Questions or ideas? Write to {emailText}. |
| `settings.contact.label` | Contact support |
| `settings.licences.label` | Licences |

## Reference images

- `assets/reference/s11b-about-and-credits.png` (normal; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Chevrons on the three facts (they do nothing).
- A remote link or web view: contact opens the phone's mail app.
