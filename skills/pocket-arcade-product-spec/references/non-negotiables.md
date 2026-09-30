# 3 · Non-negotiables N1-N12

These twelve rules are settled. Nothing in any task, design or later decision may contradict them. If a task would break one, stop and ask the owner before writing code; never trade one away for convenience.

Each rule below has the spec text, what it means in practice, and what enforces it in the app repo.

## Contents

- N1 Offline first
- N2 No accounts, no server, no cloud
- N3 Our own code makes no network requests
- N4 One game = one app
- N5 One Shell
- N6 Four languages from day one, both directions
- N7 One purchase
- N8 Ads never interrupt play
- N9 Everything is made by Claude Code
- N10 Saved progress survives every app update
- N11 No layout code says "left" or "right"
- N12 Every sentence is one translatable message

### N1 · Offline first

Every game, every screen and every feature works in airplane mode, forever. The only things that need the internet are loading ads and talking to the App Store or Google Play to buy or restore the purchase. Neither is required to play.

- In practice: playing, saving, levels, daily challenge, statistics, settings and languages never need the network. Offline, no ad appears and the player never sees an error, a wait or a "please connect" message; the Premium page says "Connect to the internet to buy or restore."
- Enforced by: an offline journey flow on the simulator (debug switch "Simulate offline", because iOS simulators have no airplane mode), and all data stored locally in SQLite.

### N2 · No accounts, no server, no cloud

No sign-in, no user profile and no backend of ours. No cloud saves, no online leaderboards, no multiplayer. No analytics, no crash reporting service, no remote configuration.

- In practice: errors go to a small local error log that the debug menu shows (spec 8.14). The phone's own device backup may include the save (decision D5); that is the operating system's feature, not a request from us.
- Enforced by: a banned-package list (analytics, crash reporting, remote config, update services), a banned native SDK and pod list, and the network audit.

### N3 · Our own code makes no network requests

The only network traffic in the app comes from (a) the Google AdMob ads component and (b) the operating system's store purchase system (Apple / Google). A build check enforces this: the list of allowed network-capable components contains exactly those two, and anything else fails the build.

- In practice: no `fetch`, `XMLHttpRequest`, `WebSocket`, remote image or font URLs, and no new network-capable SDK in app code. Online detection uses the OS path monitor (no HTTP probe). Rate and contact open the store app and the mail app through the OS.
- Enforced by: lint rules on our code, a scan of the release JavaScript bundle, a scan of native module sources, a vendor pod allowlist, config assertions, and a runtime socket check on the simulator (six layers; the `privacy-and-network-audit` skill owns them).

### N4 · One game = one app

Each game has its own name, icon, store listing, ad IDs and purchase. Games never share an app.

- In practice: one Expo app folder per game (`apps/<game-id>`), one bundle ID, one Premium product (`<bundle id>.premium`). Buying Premium in one game does not unlock another.

### N5 · One Shell

All shared screens and services live in the Shell. A game module never re-implements settings, languages, ads, purchase, saving or statistics. If a game needs something the Shell lacks, it is added to the Shell for every future game.

- In practice: one monorepo; every game app consumes the same Shell package (there is no "copy the Shell" step). Dependency direction: game-kit <- shell <- apps.
- Enforced by: import-boundary lint rules (the Shell never imports an app; game rules never import the Shell UI).

### N6 · Four languages from day one, both directions

English (en) and German (de) are left-to-right; Persian (fa) and Kurdish Sorani (ckb) are right-to-left. Right-to-left is a first-class target, not a later port. Every screen is designed and checked in both directions.

- In practice: every screen is screenshot-checked in all four languages, light and dark, phone and tablet. Check fa screenshots, not only en.
- Enforced by: catalog verification (a missing text fails the build), the screenshot matrix, and lint rules against physical directions.

### N7 · One purchase

A single one-time purchase, "Premium", at about EUR 1.90. It removes all ads forever (spec 8.9). No subscriptions, no coins, no consumables, no second product.

- In practice: one non-consumable product per game; the price comes from the store and is never typed into code. Premium never unlocks levels (decision D2).

### N8 · Ads never interrupt play

No ad during a level, during the tutorial, or on app start. Full-screen ads only between levels, with frequency limits. Banners only on menu screens.

- In practice: banners only on Home, Levels and Statistics; interstitials only after the player taps Next, Replay or Try again on the Result screen and only when every spec 8.8 condition holds; rewarded ads are always the player's choice.
- Enforced by: a pure, test-driven ad policy with every numeric limit tested at exactly its value.

### N9 · Everything is made by Claude Code

All art is drawn in code (shapes, colours, glyphs). All sounds are generated or come from public-domain (CC0) sources with the licence recorded. No hand-made assets, and no paid or online generators.

- In practice: icons, app icon, splash and board art are drawn with Skia paths; sounds are synthesised in code; fonts are bundled open-licence files listed on the Licences screen (S11d).

### N10 · Saved progress survives every app update

Saves carry a version number. Every change to the save format comes with an upgrade step that is tested. Losing a player's progress is the worst bug the Shell can have.

- In practice: one versioned JSON document in SQLite, validated on load and before write, written after every move and every settings change, with a backup copy; ordered pure migrations tested against frozen fixtures; a save from a newer app version is never touched.
- Enforced by: migration tests on frozen fixtures, real-SQL tests, and a simulator kill test.

### N11 · No layout code says "left" or "right"

Menus and interface use "start" and "end", so right-to-left works automatically. Game boards are the exception and decide for themselves (spec 7.5).

- In practice: logical style properties only (`marginStart`, `paddingEnd`, `start`, `end`); all text through the Shell's text component; boards are wrapped left-to-right unless a game opts in to mirroring.
- Enforced by: lint rules that reject physical style keys and `textAlign: 'left' | 'right'` outside the text component.

### N12 · Every sentence is one translatable message

No sentence is glued together from pieces. Numbers and names are placeholders inside the translated sentence, and plural forms come from the translation files.

- In practice: every visible string is one catalog message in en, de, fa and ckb with named placeholders (`Level {level} complete in {moves} moves`); no string literals in JSX; no "if one" checks in code.
- Enforced by: a JSX-literal lint rule and the catalog linter (`npm run i18n:verify`).
