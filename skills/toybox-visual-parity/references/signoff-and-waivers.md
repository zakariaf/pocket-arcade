# The look pass, the sign-off ledger and waivers

The machine gates prove geometry, strings, colours, type and shape. What they cannot see (icons, drawings, shadow feel, optical alignment, wrapping, mirroring, the Toybox character) Claude checks by looking at the sheets, and records in a ledger that `check-signoff.mjs` verifies. This page is the procedure and the two file formats.

## Contents

- Reading the sheets
- The done set
- The sign-off ledger: parity/signoff.json
- Waivers: parity/waivers.json
- Pre-listed waivers
- Intended reference changes are not waivers
- Committing waivers and game facts
- What goes into the owner report

## Reading the sheets

`make-sheet.mjs` (run by `run-parity.mjs`) writes into each run folder:

| File | What it shows | How to read it |
|---|---|---|
| `sheet.png` | design, app and pixel diff side by side at 1 px per pt; failing elements outlined in magenta; masks hatched grey. A tall frame's capture shows the design as that capture should look (fixed top bar, body scrolled like the app, pinned banner), then a fourth panel with the full-height design and the captured body window between cyan lines | Read first. Compare the two phones as wholes: same blocks, same order, same weight. In the diff panel, red = the app is different or lighter, blue = darker; scattered specks on text edges are anti-aliasing and mean nothing |
| `zoom-1.png` ... | design (for a tall frame: the design window of this capture) and app in bands of 220 pt at 2x | Read every band. This is where icons, shadows, radii, line breaks and alignment show |
| `crops/<testID>.png` | design, app and diff of each failing element at 3x with 4 pt of context | Read for every failing element before changing code: it shows what is actually different |
| `eye-1.png` ... | every icon, logo and picture (checks include `crop`) as design and app pairs at 3x | Read every page; the testIDs are listed top to bottom in `sheets.json` (`eyePages`) and in the script's output |

Look for the seven eye checks (details in [what-exact-means.md](what-exact-means.md)): `icons`, `pictures`, `shadows`, `alignment`, `wrapping`, `direction`, `feel`. Anything visibly different is a difference to fix, even when every gate passed: the gates have tolerances, the owner's eye does not.

## The done set

A frame is signed off in **light and dark x en and fa**, at every scroll offset `run-parity.mjs` plans for a tall frame, against the reference its game's facts pick (a composed variant such as `s6-pause--no-music--no-hints` included). That is `check-signoff.mjs`'s default. `--themes` and `--langs` narrow a check while fixing one variant, but a narrowed check is never a sign-off: it prints `narrowed: not a sign-off` and exits 1 (rule `narrowed`). de and ckb join the set before a release (render their references with `shoot-design.mjs --out .parity/design --lang de,ckb` and pass `--langs en,fa,de,ckb --reference .parity/design`). A ledger with only light en and dark fa entries (as round 3 kept) is not done.

## The sign-off ledger: parity/signoff.json

One entry per run (frame x theme x language x scroll offset), committed in the app repo. `check-signoff.mjs --draft <run-dir>` prints a skeleton after `make-sheet.mjs` ran:

```json
{
 "game": "lineSiege",
 "frame": "s4-home",
 "theme": "dark",
 "lang": "fa",
 "scrollY": 0,
 "sheetSha256": "<sha256 of this run's sheet.png, filled in by --draft>",
 "date": "2026-09-28",
 "looked": ["sheet.png", "zoom-1.png", "zoom-2.png", "zoom-3.png", "zoom-4.png", "eye-1.png"],
 "eyeChecks": { "icons": "match", "pictures": "match", "shadows": "match", "alignment": "match", "wrapping": "match", "direction": "match", "feel": "match" },
 "differences": [
  { "what": "settings gear drawn 2 pt too small", "status": "fixed" }
 ]
}
```

- `looked` lists every image of the run except the crops; `check-signoff.mjs` fails with `not-looked` if one is missing. List only what was actually read.
- Each eye check is `"match"`, `"n/a"` (for example `direction` on a screen with no directional parts in en) or `"waived: <reason of 20+ characters>"` for a platform limit the owner was told about. `"open"` or anything else fails `eye-check-open`.
- `differences` records what the look found: `"fixed"` once fixed and re-checked, `"waived"` with a waiver, `"open"` blocks sign-off (`difference-open`).
- `sheetSha256` ties the entry to one sheet: any new capture or new reference makes a new sheet, and the old entry no longer counts (`looked-at-old-sheet`). Look again, then update the entry.
- **After a rebuild**, `check-signoff.mjs --draft <run-dir> --from-ledger` prints the new entry with the previous entry's recorded `differences` for the same game, frame, theme, language and scroll offset copied in (every eye check starts `open` again, because the new sheet must be looked at). Check each copied difference is still true, answer the eye checks, and replace the old entry. It refuses sheets older than the latest check (`stale-sheet`) and a broken ledger (`ledger-invalid`).
- `check-signoff.mjs` also refuses runs that are not real captures (`not-a-capture`: a design-as-app run, a copied image), stale reports (`stale-report`), stale or edited sheets (`stale-sheet`), failing runs (`not-passing`), missing variants (`not-captured`) and tall frames with elements never on screen (`coverage`).

## Waivers: parity/waivers.json

A waiver accepts **one named problem of one element on one frame** that the app cannot fix. It is rare, it is written down, and it is reported. There are three classes; `class` says which (omitted means `platform`).

| Class | When | Extra field | Rules it may cover |
|---|---|---|---|
| `platform` | iOS or React Native cannot draw it like the design, and no style or layout can change that | - | `missing`, `bounds`, `text`, `fill`, `border`, `text-ink`, `structure` |
| `platform-text-shaping` | CoreText shapes certain glyphs or marks differently from Chrome's HarfBuzz with the same font file (the ink is narrower or wider, not moved) | `glyphs`: the characters or marks, for example `"آ"` | `text-ink` only |
| `design-artefact` | the mockup's own CSS draws something the product does not mean, and the copy deck or component is right | `designCause`: the CSS rule in `assets/design/toybox.html` and what it does | every waivable rule except `missing` |

The format, with one waiver of each extra class (the madda entry shows the fields; since text ink is measured by colour, S4's آمار is 0.67 pt narrower and passes without it; the tile-13 entry is one of the pre-listed pair below):

```json
{
 "version": 1,
 "waivers": [
  {
   "frame": "s4-home",
   "testID": "home.stats-button",
   "rule": "text-ink",
   "class": "platform-text-shaping",
   "glyphs": "آ",
   "langs": ["fa"],
   "reason": "CoreText draws the madda of U+0622 about 0.8 pt shorter than Chrome's HarfBuzz with the same Vazirmatn-Bold.ttf, so the word is 1.3 pt narrower; no style changes mark shaping.",
   "reportedToOwner": "2026-09-29"
  },
  {
   "frame": "s8-levels",
   "testID": "levels.level-tile.13",
   "rule": "bounds",
   "class": "design-artefact",
   "designCause": ".lt.is-pressed{transform:translateY(3px) scale(1.04,.94)} keeps the tapped locked tile squashed in the mockup, so its drawn box is 55.8 x 58.3 instead of 53.7 x 62",
   "reason": "The frame draws tile 13 frozen mid-press; the app shows the tapped tile at rest with its focus ring, as the S8 spec says. A press squash cannot be held after the finger lifts, and bounds never see transforms.",
   "reportedToOwner": "2026-09-30"
  }
 ]
}
```

- Fields: `frame`, `testID` (exact, no wildcards), `rule`, optional `class`, `glyphs` (text shaping only), `designCause` (design artefact only), optional `themes` / `langs` / `games` lists, `reason` (20+ characters naming the limit or the artefact), `reportedToOwner` (the date of the report that told the owner). Any other field (a tolerance, a threshold) makes the file invalid: a waiver never changes a number.
- `screen-not-reached`, `capture-size`, `duplicate-testid` and anything about the capture itself are never waived: they mean the comparison did not happen.
- Not a waiver: "close enough", "will fix later", or "the design is wrong" without the CSS that proves it. The first is a fix, the second an open difference, the third a question for the owner (stop and ask).
- `check-parity.mjs` prints waived problems as `WAIVED` notes with their class, and an unused waiver as a note to delete it. `check-signoff.mjs` lists every waiver of the frames it signs off, with its class, its glyphs or CSS cause and the owner-report date.
- A mockup artefact the owner or the lead fixes in the design stops being a waiver: the references are re-rendered (an intended reference change, below) and the waiver is deleted. The S11 footer's old 6 px gap in "Version 1.0.0 (8)" went that way on 2026-09-30 (L5).

## Pre-listed waivers

Some differences show on every correct build, have a known cause and were reported to the owner once. They ship as entries of `templates/parity/waivers.json`, which the app repo copies to `parity/waivers.json`; `check-parity.mjs` names the entry in its fix text when such a problem is not waived yet. Before relying on one, open the element's crop and confirm the difference is exactly that cause and nothing else.

| Class | Frame | testIDs | Rule | Cause |
|---|---|---|---|---|
| `platform` | `s8-levels` | `levels.level-tile.14` to `levels.level-tile.30` (the locked tiles), `levels.pack.2` (the locked pack panel) | `structure` | React Native on iOS draws `borderStyle: 'dashed'` with its own dash length and corner phase, and no style sets them; Chrome's dashes sit elsewhere, so the edge differs along the dashes only. Nothing re-draws dashed edges in Skia to imitate Chrome. |
| `platform` | `s7-result-lose` | `result.continue-offer` (the offer box, which has its own crop for this reason) | `structure` | the same dash pattern |
| `platform` | `s9-daily-challenge` | `daily.week-day.1.mark` (the fixture's missed Monday), `daily.week-day.7.mark` (today), `daily.week-card` (the legend's dashed missed swatch inside it) | `structure` | the same dash pattern |
| `platform` | `s9-daily-challenge` (dark fa) | `daily.today-card.calendar.month` | `text-ink` | the month sits on the tilted calendar tile, and iOS draws the edges of a rotated view without antialiasing (React Native exposes no `allowsEdgeAntialiasing`): Chrome's antialiased edge pixels next to the word count as ink in dark fa, the app's stepped edge does not; the word itself matches |
| `platform` | `s12-store-unavailable-offline` | `premium.buy-button` (the disabled key's dashed edge) | `structure` | the same dash pattern |
| `design-artefact` | `s8-levels` | `levels.level-tile.13` | `bounds` and `structure` | `.lt.is-pressed{transform:translateY(3px) scale(1.04,.94)}`: the mockup draws the tapped locked tile mid-press |
| `design-artefact` | `s11b-about-and-credits` (en) | `about.version-chip` | `bounds`, `text-ink` and `structure` | `.chip{display:inline-flex;gap:6px}` splits "Version " and the version into two flex items 6 px apart (the artefact L5 fixed only in the S11 footer); the app writes one text with one space |

A dashed edge that is missing, too thick or in the wrong colour is still a fix: the waiver covers the dash pattern, not the edge.

What is no longer a waiver since round 4 (the gates or the references handle it, so copying a round-3 entry for it is wrong): the S12 state cards' mini heading, root and small print (state cards are compared by parts, ink size and painted shape), the S12 restore toasts' corners, S13's example picture and stage fill (masked as a game board), S14's dimmed Settings with Music rows (the `--no-music` variant), Home's banner and the texts under the S14 dialog cards, the "English" sample of the System row (re-rendered in the render language), the 5 pt sliver of S11c fa, and the S10 fa "×۶" window. What stays: a real platform limit found on a capture, such as the S14 restart card in Persian (platform, `langs: ["fa"]`): its three two-line Vazirmatn texts snap to the device pixel grid on iOS, so the centred card comes out a few device pixels taller than Chrome's (round 3: 0.33 pt; round 4: 1.33 pt, 2 px at each edge) while every text still matches, recorded with the measured size in its reason.

## Intended reference changes are not waivers

When the references themselves change on purpose (the owner or the lead changed the design, or the whole set was re-rendered), the change is recorded in the reference manifest's `referenceChanges` log (`{ id, date, frames, variants, what, why }`; design-reference-set.md, "The log of intended reference changes"), not in `parity/waivers.json`. A waiver accepts a difference between the app and a reference; a change entry says why the reference is what it is. `check-signoff.mjs` prints the change entries of every frame it signs off, and each one goes into the owner report ("intended reference change L1 (2026-09-30): ...").

## Committing waivers and game facts

`parity/waivers.json` and `parity/game-facts.json` are gated paths: they change what the parity gate accepts and which reference a frame is compared with. A commit that changes either carries a `Gate-Change:` trailer (git-commits-and-reporting) and names each waiver it adds or removes, or each fact it changes, in its body, so the owner finds them with `git log --grep Gate-Change`. `parity/signoff.json` is not gated: the ledger records looks, not tolerances.

## What goes into the owner report

For each screen signed off, one line per frame: the reference used (base, variant or composed variant, with the game facts that chose it), the variants that pass (for example "s4-home: light/dark x en/fa pass, 0 problems"), what was checked by eye, every waiver with its class and reason, every intended reference change `check-signoff.mjs` printed for the frame, and any open question. A `design-artefact` waiver always comes with its question to the owner (for S8: "the mockup draws tile 13 mid-press; keep the waiver, or draw the tapped tile at rest and re-render?"). Attach or link the `sheet.png` of the dark fa run (the hardest combination) so the owner can see it without running anything.
