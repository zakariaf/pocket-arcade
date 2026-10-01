# Writing to the owner: evidence after every slice and release

The owner reads plain English, not logs, and never reads code. Every finished slice and every release ends with an evidence message built from the evidence files, in the shape below. `scripts/check-report.mjs` checks it before it is sent.

## Contents

- The eight rules
- The message shape
- Slice form and release form
- UI changes: the design screenshots
- Intended changes: design references, parity waivers and texts
- Where each number comes from
- Honest limits: what Claude never verifies
- Plain words

## The eight rules

1. **Lead with the outcome in one sentence, in players' words:** "Line Siege now saves after every move: killing the app reopens the same board, paused." The first line has three limits, and `check-report` names each one it breaks with the numbers: at most 240 characters ("first line is 255 characters, the limit is 240"), at most 2 sentences ("3 sentences, at most 2"), and it ends in `.` or `!` ("does not end in . or !"). It is a sentence, never a heading, list item, code fence, the Evidence line or a request. A longer outcome is split: the first sentence says what now works, the next lines give the rest.
2. **Name things the way the spec does:** screens by name and ID (Home, S4), features by section (daily challenge, 8.3).
3. **Numbers come from `reports/`**, never from memory; name the file on the line.
4. **At most one request per message**, answerable in a word, with the default that applies until then: "Please create the App Store Connect app record for Flock Tilt (step G2, about 2 minutes). Until then I keep working on the board."
5. **Point at no more than five things to look at**, and say where (gallery row, screenshot file, TestFlight build).
6. **Be honest about limits:** list what was not verified (sound, haptics and 120 Hz need a phone; purchases need TestFlight).
7. **Keep technical detail out of the first lines.** Stack traces, commands and file lists go after a "Details" line at the end, or into the commit messages.
8. **List the owner's personal checks, never wait for them.** The owner reviews the fa and ckb texts, play-tests the game and listens to the sound previews personally. Every slice and release report has an "Owner steps (not blocking)" block with one line each, saying what is pending or "none pending"; no gate and no step of the work waits for them (rule `owner-steps-listed`).

## The message shape

```text
<one sentence: what now works, in players' words>

<optional: one request with its default>

Evidence: <game-id or area> <slice or release> on <YYYY-MM-DD>, commit <sha>

Checks
- Types, lint, format: pass
- Tests: <passed>/<total> pass (unit <n>, golden <n>), random seed <seed>
- Coverage: lines <x>% (gate 90), logic folders <x>% (gate 95)         reports/coverage/coverage-summary.json
- Mutation (release only): <score>% (break 75), survivors explained below reports/stryker/mutation.html
- Bots: <summary line per difficulty>                                  reports/sim/<game-id>.json
- End-to-end: <passed>/<total> flows pass, quarantined: <none | list>  reports/e2e/<game-id>/junit.xml
- Network: 0 JS attempts, no non-loopback sockets                      reports/e2e/<game-id>/network.txt
- Screenshots: <n> captured, <n> changed (all intended)                reports/screenshots/index.html

What changed for players
- <one line per behaviour, in the spec's words>

Please look at (at most 5)
- <screenshot or gallery row>, because <reason>

Goldens and baselines changed on purpose
- <file>: <reason> (Gate-Change trailer in <sha>)

Owner steps (not blocking)
- fa and ckb texts: <pending texts, or "none pending"> (step R3)
- Play-test <game>: <still open, or done on YYYY-MM-DD> (step G6)
- Listen to the <game> sound previews in reports/sfx/<game-id>/: <still open, or done> (step G9)

Not tested or not verified
- <honest list: device-only behaviour, StoreKit tiers 2 and 3, a keyless rehearsal, anything skipped>

Details
<commands, file lists, red runs, anything technical>
```

`templates/evidence-slice.md` and `templates/evidence-release.md` hold this shape with `__PLACEHOLDERS__`; the examples show both filled in.

## Slice form and release form

| Part | Slice | Release |
|---|---|---|
| Outcome sentence | required | required |
| Evidence line | required (`slice` in it) | required (`release` in it) |
| Checks: Types, lint, format; Tests | required | required |
| Checks: Coverage, Mutation, Bots, End-to-end, Network, Screenshots | when the slice ran them, each with its `reports/` file | all required, each with its `reports/` file |
| Checks: Design match | required when the slice changed a screen | required (every screen), naming `parity/signoff.json` |
| What changed for players | required | required |
| Please look at | when there is something to look at (at most 5) | the gallery rows that changed (at most 5) |
| Goldens and baselines changed on purpose | when any changed | required ("none" when none) |
| Owner steps (not blocking) | required: the fa and ckb review, the play-test, the sound previews | required: the same three |
| Not tested or not verified | required | required |

For a release, also open the screenshot gallery for the owner (`open reports/screenshots/index.html`) and list the manual checks: the play-test with the TestFlight purchase test (G6), listening to the sound previews (G9) and the review of the fa and ckb texts (R3) under "Owner steps (not blocking)", and the VoiceOver spot check (R2) under "Not tested or not verified". The one request of a release report is the owner's "ship" (R1), because the release tag and the submission leave the Mac; it never waits for the play-test.

**A keyless rehearsal is not release evidence.** Without the owner's signing key, a store archive built with `CODE_SIGNING_ALLOWED=NO` may be checked with `check-store-artifact --unsigned`, which prints `REHEARSAL: not a release gate`. Mention such a run only under "Not tested or not verified" (or Details); a Checks line or any other line that cites it fails rule `rehearsal-not-evidence`.

**Neither is an owner-placeholder FAIL.** Until the owner supplies the privacy-policy host and support address (step G3) and the real AdMob app id and units (step G5), every ship gate (`check-game-app --stage complete`, `check-release-setup`, `check-store-artifact` with or without `--unsigned`, `audit-app-bundle` with or without `--unsigned`, the release pipeline's `store-gate.ts` and `check-sim-app --variant store`) ends with `owner-placeholder` lines, then `OWNER STEPS PENDING: G3, G5`, then `RESULT: FAIL`, by design. That result proves nothing about the release: a line outside "Not tested or not verified", "Details" and "Owner steps (not blocking)" that cites it fails rule `owner-placeholder-not-evidence`.

**A pilot handed over before the owner's key and ids ends with a slice report** (`check-report.mjs <report> --kind slice`), never a release report: the keyless rehearsal and the owner-placeholder results go under "Not tested or not verified", and G3 and G5 get one line each under "Owner steps (not blocking)" (they may say which gates wait for them: "G3: the privacy-policy host and support address; until then the ship gates end with OWNER STEPS PENDING: G3, G5"). The release report, with its Mutation and Screenshots lines, follows the first real upload.

For a slice, put the red run's assertion lines (Expected / Received) under Details: they are the evidence that the test came first.

## UI changes: the design screenshots

The owner's rule is that every built screen matches its Toybox design screenshot. A slice or release that changed a screen adds one Checks line and points at the comparison:

```text
- Design match: Home (S4) matches its Toybox design screenshot in en and fa, light and dark (machine gates pass, 7 eye checks signed off, 0 waivers)   parity/signoff.json
```

The visual-parity work (the `toybox-visual-parity` skill) records each signed-off run in the committed ledger `parity/signoff.json` and draws its side-by-side sheets under `.parity/<run>/` (gitignored). Name the ledger on the line, list every waiver from `parity/waivers.json` under "Not tested or not verified" with its reason, and put the dark fa `sheet.png` of the screens that changed most under "Please look at". `check-report.mjs` treats a "Design match" line like the other number lines: it must name where the result is recorded (`parity/signoff.json`, or a `reports/` or `.parity/` file). A screen that does not match yet is not done; it goes under "Not tested or not verified" with the reason, never under Checks.

## Intended changes: design references, parity waivers and texts

Three kinds of change are deliberate but easy for the owner to miss, so each gets its own block in the report when the work made one. Paste the blocks from `templates/report-changes.md` above "Not tested or not verified"; `examples/reference-and-copy-changes.md` is a complete report with all three. `check-report.mjs` checks every line of each block that is present.

**Design references changed on purpose.** The committed design screenshots (the references the parity gate compares with) change only on purpose, and every such change is logged in the reference manifest's `referenceChanges` list with an id, a date, the frames and variants, what changed and why (for example P-8, the re-render of 2026-09-29 with identical pixels; L1 to L5, the changes the lead approved on 2026-09-30). It is never a waiver. One line per change: the frames and variants it touched (`s8-levels light-fa and dark-fa`, `s7-result-win--score`), what the picture now shows in players' words, why, and `(change <id>)`. A change that alters no pixels still gets its line and says so ("no frame pixels changed"). Rule `reference-change-id`.

**Parity waivers changed.** A waiver in `parity/waivers.json` changes what the parity gate accepts, so the file is a gated path: the commit that adds, removes or edits a waiver carries `Gate-Change: <which frames, which class, why>` and the report repeats it. One line per waiver group: the screen and elements, the class (`platform` for an iOS drawing difference such as React Native's dashed edges, `platform-text-shaping` for a glyph difference, `design-artefact` for a mistake in the design picture such as a tile drawn mid-press), the rule, the cause in plain words and `(Gate-Change trailer in <sha>)`. A retired waiver gets a line too. The owner finds all of them with `git log --grep Gate-Change`. Rule `waiver-trailer`. The same trailer rule covers `parity/game-facts.json`, the file that picks a game's reference variants.

**Texts changed in all four languages.** A player-visible text that changed (a copy-deck text such as a tutorial step, or a new Shell text the deck lacks, such as the score line of a score-rated win) is reported once per text, not per language: where it shows, the new English text, that de, fa and ckb changed with it, and that the fa and ckb drafts go to the owner's review (R3). Name those texts on the fa and ckb line of "Owner steps (not blocking)" (never "none pending" while texts changed); the review never blocks the work or a release. Debug texts (every `debug.*` key, the S15 Debug menu of test builds) stay English in all four languages (lead decision L13), so they never appear on that line or in the review sheet's counts. Rules `copy-review` and `owner-steps-listed`.

## Where each number comes from

| Line | Source file |
|---|---|
| Tests | passed/total and the random seed from the Jest summary of `npm run test:coverage`. That summary is one combined line for both projects, so take the golden count from `npx jest --ci --selectProjects golden` (its "Tests: <n> passed" line) and write unit = total minus golden (round 4: 2274/2274 pass, golden 65, so unit 2209) |
| Coverage | `reports/coverage/coverage-summary.json` |
| Mutation | `reports/stryker/mutation.json` and `mutation.html` |
| Bots | `reports/sim/<game-id>.json` |
| End-to-end | `reports/e2e/<game-id>/junit.xml` |
| Network | `reports/e2e/<game-id>/network.txt` (empty means no sockets) and the debug menu's "network attempts: 0" |
| Screenshots | `reports/screenshots/index.html` and `summary.json` |
| Design match | `parity/signoff.json` (the sign-off ledger) and `parity/waivers.json`; the sheets are in `.parity/<run>/` |

Never round up, never type a number from memory, never call a check that did not run "pass". A check that was not run goes under "Not tested or not verified".

## Honest limits: what Claude never verifies

- Sound, haptics and 120 Hz smoothness need a real phone.
- Purchases beyond the local StoreKit harness need TestFlight (the owner's G6, listed under "Owner steps").
- Persian and Sorani wording gets the owner's review (G7, R3); Claude writes natural drafts and lists them, and nothing waits for the review.
- How the sounds and haptics feel: the owner listens to the previews and tries a phone (G9); the simulator only proves the app asked for them.
- VoiceOver needs the owner's spot check (R2).
- Real ads (live IDs) are never shown in test builds.
- Anything skipped, quarantined or flaky in this run.

## Plain words

| Instead of | Write |
|---|---|
| "Implemented the recordDailyResult reducer with an idempotent merge" | "Playing today's challenge twice no longer counts twice for the streak." |
| "Fixed an RTL layout bug in the level grid" | "In Persian and Sorani, level 1 is now at the top right of the Levels screen (S8)." |
| "All tests green" | "Tests: 214/214 pass (unit 192, golden 22), random seed 48213" |
| "Ads work" | "A full-screen ad now appears only after tapping Next, at most once every 3 minutes (spec 8.8); Premium players never see one." |
