# Stop and ask

Stopping is not failing. For each case below, stop that line of work, send the owner one message, and continue with other work if there is any. The owner answers in plain words; make every question answerable in a word.

## Contents

- When to stop and ask
- The owner's human steps (IDs to name)
- Release stops: errors that are never retried
- How to write the message

## When to stop and ask

| Situation | What to do |
|---|---|
| A human step is needed (the IDs below) | name the step ID and the one action needed; never simulate or skip it |
| A gate looks wrong or blocks: a lint rule, a limit, a threshold, a tolerance, a baseline, an audit finding | do not edit the gate; send the gate note (gate, file and line, message, why it looks wrong, smallest change); edits to gate files prompt the owner anyway |
| A change would touch a gated path (quality gates, goldens, baselines, fixtures, `.npmrc`, network baselines, parity waivers and game facts) other than by an intended, explained change | ask; an agreed change goes in one commit with a `Gate-Change:` trailer |
| The spec is contradicted, ambiguous or silent about something a player would see | quote the spec lines, give the options with a recommended default, keep working; never trade away N1-N12 |
| Two of the project's instructions disagree | follow the one that owns the topic, say so in the report, and name the other so it gets fixed |
| Irreversible or outward-facing actions: an App Store Connect upload, submitting for review, creating or changing App Store Connect records (Premium product, age rating, tester groups), turning on Family Sharing, pushing branches or tags, force-pushing or rewriting pushed history, deleting files, data or simulators this session did not create, sending anything to a third party | ask first, unless the owner asked for exactly this action in this session; submit for review only after the owner says "submit" |
| A release stop (next section) | stop, do not retry, do not switch signing methods; one message with the step and the exact error line |
| Anything that would read, print, copy, move or commit the App Store Connect `.p8` key, a JWT or a password | never; if a task seems to need it, ask |
| A new dependency outside the documented procedure, a banned package, a held-back major version, an early release-age exception | ask, unless the dependency procedure covers it exactly |
| An open owner decision becomes blocking | use the documented default and say so; ask when the default no longer works |
| The Stop hook still fails after its 8 continuations | report the failing gate and what was tried |

## The owner's human steps (IDs to name)

Once, per owner and Mac:

| ID | Step |
|---|---|
| O1 | Keep the Apple Developer Program active; accept the Program License Agreement and, in App Store Connect > Business, the Paid Apps Agreement with tax and banking (Premium cannot be sold or reliably sandbox-tested without it) |
| O2 | Declare EU Digital Services Act trader status in App Store Connect (without it, apps leave the EU storefronts, Germany included) |
| O3 | Create or confirm a team App Store Connect API key with the Admin role, save the `.p8` in the agreed private folder, set `ASC_KEY_ID` and `ASC_ISSUER_ID` |
| O4 | Install Xcode and accept its licence with `sudo` (about once a year) |
| O5 | Install TestFlight on the owner's iPhone, signed in as an internal tester |
| O6 | Approve Claude Code's permission prompts when hooks or permission rules are added to `.claude/settings.json` |
| O7 | Fallback only: sign in once in Xcode > Settings > Accounts if the first API-key archive cannot create the development certificate |
| O8 | Only when it happens: unlock the login keychain (`errSecInternalComponent`) |
| O9 | AdMob account and payments profile, the published GDPR/TCF consent message, and blocking controls (A1, A3, A4) |
| O10 | Later: the Google Play developer account |

Per game:

| ID | Step |
|---|---|
| G1 | Approve the app name and the bundle ID (the ID matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`, the name is unique on the App Store) |
| G2 | Create the app record in App Store Connect (no API exists for it; about 2 minutes) |
| G3 | Fill in the App Privacy questionnaire, together with decision D4 |
| G4 | Check (or create) the Premium in-app purchase; the first one is submitted with an app version |
| P1 | Part of G4: decide Family Sharing (default off, irreversible once on) and confirm the price point when EUR 1.90 is not one (D3) |
| G5 | AdMob: create the app and 3 ad units and give the IDs; after release, link the store listing and publish `app-ads.txt` (A2, A5) |
| G6 | Play-test on TestFlight, including the purchase test: buy, cancel, restore after reinstall |
| G7 | Have a native speaker read the Persian and Sorani texts |
| G8 | Approve the store listing (texts, screenshots, age rating answers) |

Per release:

| ID | Step |
|---|---|
| R1 | Play the TestFlight build and answer "ship" or "don't ship" |
| R2 | VoiceOver spot check (about 15 minutes) |
| R3 | Native-speaker read of changed Persian and Sorani strings |
| R4 | Accept any new Apple agreement reported as blocking |
| R5 | Submit for review (one click, or tell Claude "submit"); on the first release, add Premium to the version first |
| R6 | Answer App Review messages; choose manual or automatic release after approval |

AdMob console steps: A1 account and payments (once); A2 per game the app and three ad units (banner, interstitial, rewarded); A3 publish the European regulations consent message (English and German); A4 blocking controls (gambling, dating, alcohol, get-rich-quick; maximum rating PG); A5 after the first release, link the store listing and publish `app-ads.txt`; A6 never needed: live-ID device testing (test builds always use test units).

## Release stops: errors that are never retried

Stop, do not retry, do not switch signing methods, and send one message with the step and the exact error line:

- `errSecInternalComponent` from `codesign` (the login keychain is locked: human step O8).
- Any agreement error (`agreement`, `PLA Update available`, a `FORBIDDEN` that mentions an agreement: human step R4, then rerun from the failed step).
- A missing app record (human step G2).
- HTTP 401 (`NOT_AUTHORIZED`: wrong key or issuer ID, revoked key, clock skew) or 403 (`FORBIDDEN_ERROR`: key role below Admin or an individual key; human step O3).
- A processing state `INVALID` or `FAILED` (ask the owner to forward Apple's email; fix, then rebuild with a new build number).

## How to write the message

- One message, one request, answerable in a word, with the default that applies until the owner answers: "Please create the App Store Connect app record for Flock Tilt (step G2, about 2 minutes). Until then I keep working on the board."
- Name the step ID when there is one, and how long it takes.
- For a release stop: the step, the exact error line, the one action needed (`templates/release-stop.md`).
- For a spec question: quote the spec lines, give the options, and say which default you are using meanwhile (`templates/owner-request.md`).
- Filling `templates/owner-request.md`: for a human step keep the `(step ..., about ... minutes)` part and delete the three bullet lines; for a spec question delete the step part, write "Please answer A or B", and keep the quoted spec lines and the options (print the spec lines with the product-spec skill's lookup, never from memory).
- Before sending, save the message to a file under `reports/` (gitignored) and run `node ${CLAUDE_SKILL_DIR}/scripts/check-report.mjs <file> --kind request`; `examples/owner-requests.md` shows one of each kind.
- Then keep working on whatever does not depend on the answer.
