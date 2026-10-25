# Flock Tilt: design notes

Game 2 of the catalogue (`flock-tilt`), written before any code (new-game step 1; spec 13: "Each
game gets its own design pass, approved by the owner, before it is built"). Every section gives the
proposed answer, the reason, and what changes if the owner answers differently. The spec lines are
quoted from `spec-lookup.mjs flock-tilt 13 12 10 11 8.1 8.2 8.3 8.5 8.10 D2 D9`, never from memory.
Status: proposed on 2026-10-19; the defaults below apply until the owner answers.

## What it is

- Spec 13, flock-tilt: "Pitch: tilt the whole field and every sheep slides at once; pen them all
  without bumping the wolf." "Core loop: look at the field and tilt it; everything slides until it
  hits something; sheep that reach the pen drop in; undo freely, then move on to the next field."
  "The twist: the player never moves one animal, so sheep are each other's blockers. The wolf slides
  by the same rules, and any sheep that ends up against it is lost."
- Spec 13, v1 content: "one 7x7 field, rocks, a pen, sheep and 1-2 wolves; generated fields with par
  3-8 and a daily set."
- **The field.** 7 x 7 cells inside a fence. Rocks fill some cells; one cell is the pen; 2 to 6 sheep
  and 1 or 2 wolves stand on other cells. Nothing is random after the field is made.
- **A tilt** (up, down, left or right) slides every animal on the field in that direction at once,
  the animal nearest the fence in that direction first, then the next, so animals pile up behind
  each other. Each animal slides cell by cell until the next cell is the fence, a rock or another
  animal. A sheep that slides onto the pen drops in and is counted (the pen holds any number of
  sheep, and the cell is free again for the sheep behind). A wolf treats the pen like a rock.
- **The wolf rule (gentle).** After every animal has stopped, a sheep that touches a wolf along the
  tilt (the wolf right in front of it or right behind it) is lost: the toy's rule, "any sheep that
  ends up against it". A sheep beside a wolf across the tilt is safe. Nothing is ever hit on screen:
  the lost sheep is marked and the run ends.
- **Win:** every sheep is in the pen. The score is 100 points per penned sheep (the top bar shows
  it while playing); a win adds 10 points per tilt left of the 40-tilt budget (a whole number, at
  least 0; the S7 win shows it, while the stars come from the moves against par).
- **The tilt budget.** Every field ends after 40 tilts (the tuning file holds the number, five times
  the largest par). Undo gives the tilt back, so a player who undoes never meets it; it only ends a
  run that wanders without undoing. Reason: game-balance-and-bots rule 3 ("Every run has a hard move
  cap, and no run may reach it ... a stuck or endless game is a rules bug"): without a budget a
  field whose last sheep can no longer reach the pen would never end, and the bots' runs would hit
  the cap. The epic listed one way of losing; the skill wins over the epic (CLAUDE.md, "Which source
  wins"), so the budget is a second, rare one (below).
- **The start (`create(seed, difficulty)`).** The field is drawn from the seed with the sfc32 RNG:
  rocks, the pen, the sheep and the wolves on distinct cells; no sheep on the pen and no sheep next to
  a wolf (any of the four sides). A drawn field is kept only when the breadth-first search proves it
  winnable with par inside its tuning row's band; otherwise the next field is drawn from the same
  RNG stream. So every field, the daily included, is winnable on every phone, and the state carries
  its par (for the "solved at par" counter and the daily's moves line). Reason: spec 8.3 runs the
  daily through `create` on the phone, where no level table proves it; a daily that cannot be won
  would be the worst daily bug.
- If the owner answers differently: a different wolf rule (all four sides) or no tilt budget changes
  `apply-move.ts` and its tests, the bands and the regenerated packs, test-first.

## Classification

- **Turn-based: apply the move, then animate its events** (game-rules-engine, engine-contract.md:
  "Turn-based | 22 of 26 (Line Siege, Flock Tilt, ...) | Nothing: apply the move, then animate its
  events"). One tilt is one move; `applyMove` returns the next state and the events
  (`animals-slid` with the field width, every path and what stopped each animal, `sheep-penned`, `sheep-lost`,
  `field-cleared`, `tilts-ran-out`, `tilt-undone`), and the board animates them.
- Reason: the whole future is fixed by the field; nothing is real-time.
- If the owner answers differently: nothing else fits the pitch.

## Input

- **A 4-way swipe on the field** (`engine.panMode` `'swipe'`), **or a tap on a side of the field**
  (the strip between the field and the fence, and the fence itself, on that side) for VoiceOver users
  and one-handed play. A tap inside the field does nothing. Imitates board-gestures-and-input's
  `examples/flock-tilt/` `intentToMove`, which refuses a swipe that would move nothing: a tilt that
  moves nothing is not a legal move, so a wasted swipe is never counted.
- Spec 13: "Controls: swipe in 4 directions (or tap a side), plus Undo." Spec 8.11: "Everything can
  be played with one hand in portrait."
- `selectRegions` is `[]` (no tap-then-tap).
- If the owner answers differently: taps only would set `panMode` `'none'` and keep the side taps.

## Modes

- **Levels + Daily**, daily on by default, **no Endless**, so Home shows no Endless card.
- Spec 8.2: "LEVELS | Always on", "DAILY | One generated level per day (8.3). On by default",
  "ENDLESS | For games with no natural end ... Optional per game". Spec 13: "Modes: Levels + Daily."
- **Daily:** spec 8.3, "The level number comes from today's local date plus the game's own salt, run
  through the same generator as normal levels, at a medium difficulty." Difficulty **45** (the second
  tuning row, sampled by the sims). Salt: the scaffold's suggestion **0x9c3b**, fixed forever in
  `src/levels/flock-tilt-levels.ts` in E19-T07 (never shared with another game).
- If the owner answers differently: an endless run (fresh fields one after another) would need an
  endless row and an endless score; not proposed, because a field has a natural end.

## Packs

- **3 packs of 30 levels** (spec D9: "Default: 3 packs x 30 levels, plus Daily; Endless where it
  fits."; spec 8.1: "v1 target: 3 packs x 30 levels = 90 levels per game"), unlocked by stars (S8):
  pack 1 at 0 stars, pack 2 at 45, pack 3 at 90 (half the stars of the packs before).
- Pack names from the copy deck: "Green meadow", "Rocky hills", "Wolf country" (in four languages).
- Difficulty curve: level 1 at 0 rising to 99 at level 90 (`floor((level - 1) * 99 / 89)`); pack 1
  covers 0-32, pack 2 33-65, pack 3 66-99.
- If the owner answers differently: other counts change `game.config.ts` and the level plan, and the
  packs are regenerated.

## Stars

- **The puzzle rule of spec 8.1:** "Puzzle games: 3 stars at or under par, 2 stars at par +2, 1 star
  for finishing." Par is the breadth-first solver's fewest tilts. S7 shows "7 moves – par 7" (the base
  `s7-result-win` reference; `winLine` `"moves"`).
- If the owner answers differently: nothing but the star rule's numbers would change.

## Undo

- **Unlimited** (spec 8.5: "Undo steps back one move (unlimited in puzzle games; the game can limit
  it)"), never across a continue. Undo gives back the tilt, so the tilt budget never counts an undone
  tilt. The tutorial's last step says "Stuck? Undo is free."
- If the owner answers differently: a limit per level is one field in the rules (`undo`).

## Hints

- **`solver`:** the solver's next good move (the first tilt of a shortest winning line from the
  current field), highlighted on the board (the side of the field to tilt towards). Spec 8.5: "The
  game's solver suggests the next good move, and the Shell highlights it. Hint budget: 1 free hint per
  day, then a rewarded ad per hint, or unlimited with Premium (decision D2)." So
  `hints.freePerDay` 1, the game fact `hasHints` true, and S5 shows the hint key (L8). A field that can
  no longer be won gets no hint (undo first).
- If the owner answers differently: `none` hides the hint key (`hasHints` false) and the facts pick
  the hint-less references.

## Continue

- **`once`:** the tilt that ended the run is undone, so the lost sheep is back on the field, and the
  field gets 10 more tilts. A rewarded ad, or free with Premium; offline and not Premium, none.
  Spec 8.10: "Games may allow one continue per level or run: for example ... the last move is undone."
  "Cost: a rewarded ad, or free with Premium. Offline and not Premium: no continue." "When no continue
  can be offered, the result appears at once (S7)" (L11): while the ad loads the offer shows busy, and
  a hidden offer means none.
- One continue per run, only after a loss; a second one is refused; undo never crosses it.
- Text: `flock-tilt.continue.undo-tilt` "One more go: the last tilt is taken back and you get more
  tilts" (no digit in the sentence, so it needs no number format).
- If the owner answers differently: `none` sets `isContinueAllowed` false.

## Ways of losing

1. **`flock-tilt.lose.wolf-got-sheep`** "The wolf got a sheep" (the copy deck's text; S7: "A short,
   friendly reason: ... 'The wolf got a sheep'").
2. **`flock-tilt.lose.out-of-tilts`** "No tilts left" (rare: only a run that used the whole tilt
   budget without undoing; S7 already names "No moves left" as a friendly reason of this kind). Not
   in the copy deck: written by hand in four languages in E19-T12, fa and ckb as drafts for the
   owner's review.

- If both happen on the same tilt, the wolf wins (the sheep's loss is what the player saw).
- If the owner answers differently: without the tilt budget the second reason goes away (see "What
  it is" for why the bots need it).

## Counters (2 to 4)

- **Sheep penned** (`sheep-penned`, sum): sheep that dropped into the pen.
- **Tilts made** (`tilts-made`, sum): tilts of the kept move line.
- **Fields solved at par** (`solved-at-par`, sum): won fields with tilts at or under par (the par the
  field carries from `create`).
- Spec 10, STATISTICS: "2-4 game-specific counters with labels in 4 languages." Labels from the copy
  deck.

## Music

- **None.** The sound bank has four short synthesised sounds (tilt whoosh, bump thud, pen pop, a
  bleat when a sheep is lost) and no music; the win and lose jingles are the Shell's `ui.win` and
  `ui.lose`, played once by the game host's result step (game-audio-and-haptics' model). So S6 and
  S11 drop the Music rows and parity uses the `--no-music` references (L1); the game fact
  `hasMusic` is false.

## Age rating

- **Cartoon or fantasy violence: `NONE`** (step G1). A wolf "gets" a sheep, but nothing is ever hit,
  bitten or hurt on screen: the sheep is marked and the run ends. Spec 13's risk: "the wolf rule must
  stay gentle for the age rating."
- If the owner answers differently: `--violence-rating INFREQUENT_OR_MILD` in `game.config.ts`.

## Bands (measured in E19-T06, proposed until the owner's play-test)

- **Difficulty rows** on the 0..99 scale (lower bounds 0, 25, 50, 75; the sims sample each):

  | Row   | Sheep | Wolves | Rocks | Par band |
  | ----- | ----- | ------ | ----- | -------- |
  | 0-24  | 3     | 1      | 6-8   | 3-4      |
  | 25-49 | 4     | 1      | 6-8   | 4-5      |
  | 50-74 | 5     | 1      | 5-7   | 5-6      |
  | 75-99 | 6     | 2      | 5-7   | 6-8      |

  The first sim run (2, 3, 4, 5 sheep) showed the twist almost never in the easiest row: two sheep
  met 0.15 times per greedy run. So every row has one sheep more, and `create` keeps only fields
  whose shortest line stops a sheep against another sheep (`minSheepBlocks` 1 in the tuning file):
  the twist shows from the first field.

- **Curve:** the tilts a field takes rise row by row (greedy median 4, 5, 7, 9); the greedy win rate
  falls gently (0.79, 0.76, 0.71, 0.68), because a calm puzzle stays winnable while its plans grow.
- **Skill gap:** random < greedy < lookahead by a clear step ("A random swiper wins only about 12% of
  fields and takes about 2x par when it does", spec 13): 0.19, 0.76, 0.93 in the second row.
- **Kill test (fun within seconds):** on the easiest field the first sheep is penned within 1 to 3
  tilts in at least 90 % of the greedy bot's runs (payoff: `sheep-penned`), and the twist happens at
  least once per run (twist: a sheep stopped by another sheep, or by the wolf, in `animals-slid`).
  Measured: 94 % within 3 tilts, 1.87 twists per run.
- **Level quality** (spec 13 risk: "samey puzzles without a quality score"): the level plan rejects
  fields whose par is below the row's band and fields a random swiper wins too often.
- If the owner answers differently: bands and rows move in the tuning file with a sim run, and the
  packs are regenerated with a `Gate-Change:` trailer.

## Classification and input in code (filled in E19-T04)

- **Turn-based, a 4-way swipe on the field:** `engine.panMode` `'swipe'`, `selectRegions` `[]`.
  A move is `{ kind: 'tilt', direction: 'up' | 'right' | 'down' | 'left' }`, listed in that fixed
  order and only when the tilt moves at least one animal.
- **The state** is plain JSON: the 7 x 7 ground (rocks, the pen), the sheep (id, cell, `field`,
  `penned` or `lost`), the wolves (id, cell), the tilts made, the tilt budget, par, whether the
  continue was used and the flock before the tilt that ended the run. No RNG is kept: nothing is
  drawn after `create`.
- **The order of a tilt:** the animal nearest the fence in the tilt's direction moves first; animals
  in different lanes never meet, so ties only order the events (sheep first, then by id).
- **A run always ends:** besides the two losses, a field where no tilt can move any animal counts as
  "No tilts left" (it cannot happen from a field the search won, but the rule keeps every run
  finite and `listMoves` empty exactly when the run is over).
- **`create`** draws up to 2000 fields from the seed's sfc32 stream and keeps the first one the
  search wins inside its row's par band, with a sheep stopping against another sheep on the way (the design prototype, 200 seeds a row: 7 draws on average in the easiest row, 92 in the
  hardest, none ever used up on 800 seeds); if none is kept it uses a prepared field one tilt from
  won (never seen; a test reaches it on purpose).
