# Trail Clear: design notes

Game 11 of the catalogue (`trail-clear`), drafted 2026-10-19 for the owner's one approval message
(E28-T01). Every answer below is a proposed default: Claude builds with it while the owner reads,
and an answer that changes later becomes a test-first change in the layer it touches.

The spec lines quoted here were printed with
`node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs trail-clear 13 12 10 11 8.1 8.2 8.3 8.5 8.10 D2 D9`
(`RESULT: PASS`, 12 ids, 0 problems), never from memory.

> Spec 13, catalogue entry 11: "Edge-matching tiles on a 5x5 board; closing a road or river loop
> scores it and wipes those tiles. Risk: dead positions, and "what gets wiped" is hard to read
> before committing."

> Spec 13: "Each game gets its own design pass, approved by the owner, before it is built."

## 1. What it is

**Proposed.** A 5 × 5 board and one tile at a time. Each tile has four edges, and each edge is
grass, road or river. Drag the offered tile onto an empty cell, turned the way you want; every edge
must match the tile it touches (road to road, river to river, grass to grass), and the board's rim
counts as grass, so roads and rivers never run off the board. Inside a tile, its road edges are
joined and its river edges are joined; a tile with a single road edge ends that road at a little
house, one with a single river edge ends its river at a pond.

A road (or river) with no loose end is a closed **loop**: it runs in a circle or from end piece to
end piece. The placement that closes it scores it and wipes all its tiles from the board, which
makes room. A level deals a fixed bag of tiles; place every tile to win, and close loops to score.
The run is lost when the offered tile fits nowhere.

- **The twist:** one tile can close a road and a river at the same time (the ford: a road end and
  a river end back to back, or the bridge and twin-bend tiles). A double scores both loops twice.
  Players stop closing the nearest loop and start steering a road end and a river end toward the
  same empty cell.
- **The readability risk ("what gets wiped" is hard to read):** while a tile is dragged over a
  cell (or a turn is selected for tap-then-tap), the board outlines every tile that placement would
  wipe, and marks the cells where the chosen turn fits.
- **The dead-position risk:** the rim-is-grass rule keeps every road closable in principle; a
  share of the dealt tiles is "helpful" (a tile that can close a loop somewhere, chosen by the
  seeded RNG), more on easy rows; and the one continue clears the oldest row.

Tiles (ten kinds, edges north, east, south, west in their first turn): road end, road straight,
road bend, river end, river straight, river bend, ford (road end + river end), bridge (road over
river), twin bend (a road bend and a river bend) and road fork (three roads meet).

Scoring: a closed loop of `n` tiles scores `10 × n × n` (a 2-tile loop 40, a 4-tile loop 160), so a
long loop is worth the risk of a fuller board; a double counts both loops, then doubles the sum.

If the owner answers differently: a different board size, tile set or scoring is a rules and tuning
change before E28-T05's golden exists (cheap), or a `Gate-Change:` regeneration after it.

## 2. Classification

**Proposed: turn-based** ("apply the move, then animate its events"; game-rules-engine's
classification table already lists Trail Clear as turn-based). Nothing is simulated or real-time.
The rules draw the next tile during play, so `rng: RngState` lives in the state.

## 3. Input

**Proposed: a drag of the offered tile onto a cell, or tap a tile, then a cell; `engine.panMode`
is `'drag'`, `engine.selectRegions` is `['tray']`.**

- The tray under the board shows the offered tile once per distinct turn (two slots for a straight,
  a bridge; four for an end, a bend, a ford, a twin bend, a fork). Picking a slot picks the turn;
  the move is `{ kind: 'place-tile', turns, col, row }`. The turn is part of the move, so bots, the
  witness, the counters and the saves see one move per placement and never a "rotate" move.
- **Change from the epic's wording.** The epic's T10 test list says "a tap on the tile rotates it".
  A rotate move would be seen by the bots, the witness and the save, and a rotation kept outside the
  state does not exist in the Shell (its host keeps only a selected target). So a tap on a tray slot
  selects that turn (Line Siege's tap-then-tap, game-rules-engine rule 8: "A selection is UI state,
  never a move"), and the next tap on a cell places it. If the owner prefers one tray tile that
  rotates on tap, that needs a Shell change for every game (N5) and is a later, separate request.
- The drag lifts the ghost tile above the finger (`dragLiftPt`), as Line Siege does, and the
  "ghost cell equals placed cell" test holds.
- VoiceOver users get the placements as accessibility actions on the board, since they cannot aim.
- The board never mirrors in fa and ckb (spec 7.5: a board is a physical space).

## 4. Modes

> Spec 8.2: "LEVELS | Always on"; "DAILY | One generated level per day (8.3). On by default";
> "ENDLESS | For games with no natural end ... play until you lose, beat your best. Optional per
> game".

**Proposed: Levels + Endless + Daily** (the catalogue's modes). The endless run is
`create(seed, 100)`: the bag never empties, it is never won, and its best score shows on Home
("Endless – Best 4,210"). The daily is on by default.

## 5. Packs

> Spec 8.1: "Each game defines level packs (v1 target: 3 packs x 30 levels = 90 levels per game,
> adjustable per game; decision D9)." D9: "Default: 3 packs x 30 levels, plus Daily; Endless where
> it fits."

**Proposed: 3 packs of 30 levels**, difficulty rising from 0 at level 1 to 99 at level 90, packs
unlocked by stars (S8). Pack names: 1 "Country lanes", 2 "River bends", 3 "Crossroads" (four
languages in the copy deck).

## 6. Stars

> Spec 8.1: "Score games: 3 / 2 / 1 stars at score thresholds."

**Proposed: score thresholds per level from the witness's score** (level-generation-and-solvers'
witness rule: `[0, witness score, witness score + 20 %]`). A level is won by placing the last tile
of its bag, whatever the score (so the lowest winning score is 0, like Line Siege's wave); 2 stars
at the witness's score, 3 stars 20 % above it. S7 shows the score line "Score 1,840 – best 1,840"
(L3, `s7-result-win--score`), and `parity/game-facts.json` gets `"winLine": "score"`.

## 7. Undo

> Spec 8.5: "Undo: if the game supports it ... (unlimited in puzzle games; the game can limit it)."

**Proposed: none** (`rules.undo: { kind: 'none' }`). Every placement is final, which keeps the
score honest when the next tile is drawn from the seed.

## 8. Hints

> Spec 8.5: "Every game states whether it has hints at all. A game without hints (for example Line
> Siege) shows no hint key on the Game screen and no hint entry in the Pause menu (lead decision
> L8)."

**Proposed: `none`.** No exact solver can suggest a move in a game that draws its future from the
RNG. `hints.freePerDay` is 0, `hasHints` is false; S5 has no hint key and S6 no hint entry.

## 9. Continue

> Spec 8.10: "Games may allow one continue per level or run ... Cost: a rewarded ad, or free with
> Premium. Offline and not Premium: no continue. When no continue can be offered, the result
> appears at once (S7)."

**Proposed: `once`: the oldest row of tiles is cleared.** The board row that holds the tile placed
earliest is emptied (no score, no wipe animation of a loop); if the offered tile still fits
nowhere, the next oldest row goes too, until it fits (an empty board takes every tile, so this
always ends). A rewarded ad, or free with Premium; offline and not Premium, none. While the ad loads
the offer shows busy, and a hidden offer means none, so the result shows at once (L11). The state
records that the run has continued, and a second continue is refused (`RangeError`). Catalog key
`trail-clear.continue.clear-row`.

## 10. Ways of losing

**Proposed: one.** `trail-clear.lose.no-room`: "The tile fits nowhere" (S7: a short, friendly
reason; the epic's draft "No tile fits anywhere" reads as if every tile were tried, but only the
offered one counts). It happens when the offered tile has no legal cell in any turn.

## 11. Counters (spec 10 STATISTICS: "2-4 game-specific counters")

**Proposed, three:**

| Id             | Label (en)   | Aggregate | Counted from                   |
| -------------- | ------------ | --------- | ------------------------------ |
| `loops-closed` | Loops closed | sum       | each `loop-closed` event       |
| `tiles-placed` | Tiles placed | sum       | each `tile-placed` event       |
| `biggest-loop` | Biggest loop | max       | the largest `loop-closed` size |

## 12. Music

**Proposed: none.** Short synthesised sounds only (place, loop, double, wipe, win, lose); S6 and S11
drop the Music rows and parity uses the `--no-music` references (L1); `hasMusic` is false.

## 13. Age rating

**Proposed: cartoon or fantasy violence `NONE`** (step G1): nothing is hit, hurt or chased; tiles
are placed and wiped.

## 14. Bands and the kill test

> game-balance-and-bots, fun-and-kill-test.md: "Pass when: greedy reaches the first payoff within 3
> moves in at least 90 % of runs; greedy sees at least one twist per run; random wins clearly less
> than greedy."

- **First payoff:** `loop-closed`. **Twist:** `double-closed` (one placement closes a road and a
  river).
- **The opening (designed for an early payoff, as Line Siege's is):** every level starts with a
  prepared double spot, generated from the seed: a road end and a river end on the board face the
  same empty inner cell from opposite sides, and the first tile dealt is a ford. A reasonable
  player's first placement closes both (the payoff and the twist at move 1); after that the board
  is empty again and the bag deals from the row's tile mix. This replaces the epic's "empty 5 × 5
  board" start (E28-T04's create test checks the prepared spot instead).
- **The tuning knobs** (all in `apps/trail-clear/src/rules/trail-clear-tuning.ts`, one row per
  quarter of the 0..99 scale plus the endless row): the bag size, the tile mix (weights per kind),
  the helpful-draw share (the chance that the next tile is one that closes a loop somewhere).
- **Proposed curve** (a throwaway prototype of these rules, 100 seeded runs per cell, run before
  any code; the real sims of E28-T06 replace these numbers):

  | Row (difficulty) | Bag           | Greedy wins | Random wins | Lookahead wins | Greedy twists per run            |
  | ---------------- | ------------- | ----------- | ----------- | -------------- | -------------------------------- |
  | 0 (0-24)         | 24-26         | about 1.0   | about 0.45  | 1.0            | about 1.5                        |
  | 1 (25-49)        | 28            | about 0.9   | about 0.15  | 1.0            | about 1.2                        |
  | 2 (50-74)        | 32            | about 0.6   | under 0.05  | about 0.8      | about 1.2                        |
  | 3 (75-99)        | 36            | about 0.25  | 0           | about 0.55     | about 1.2                        |
  | Endless (100)    | never empties | never won   |             |                | about 1.2 (median 35 placements) |

  The greedy bot closed its first loop within 3 placements in 100 % of the easiest runs. The bands
  of `test/sims/trail-clear/balance-bands.json` are written around the real sims' numbers with a
  margin and stay `"status": "proposed"` until the owner's play-test (O6).

## 15. Daily

> Spec 8.3: "The level number comes from today's local date plus the game's own salt, run through
> the same generator as normal levels, at a medium difficulty."

**Proposed:** difficulty 45 (the second row), with the daily salt the scaffold suggested on
2026-10-19: **`0xe8ed`** (fixed forever in E28-T07 in `src/levels/trail-clear-levels.ts`, never
shared with another game).

## 16. Texts (four languages; fa and ckb are drafts for the owner's own review, G7)

| Text            | English                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name            | Trail Clear (Latin in all four languages)                                                                                                                                                                                                |
| Tagline         | Match the edges. Close the loops.                                                                                                                                                                                                        |
| Goal            | Place every tile. Close roads and rivers to clear them.                                                                                                                                                                                  |
| Progress line   | Tiles {placed} / {total} (endless: Tiles {placed})                                                                                                                                                                                       |
| Win title       | Every tile placed!                                                                                                                                                                                                                       |
| Lose reason     | The tile fits nowhere                                                                                                                                                                                                                    |
| Counters        | Loops closed, Tiles placed, Biggest loop                                                                                                                                                                                                 |
| How to play (4) | Drag the tile onto the board. / Edges must match: road to road, river to river. / A road or river with no loose end is cleared. / One tile can close a road and a river at once.                                                         |
| Tutorial (4)    | Drag this tile between the two ends. (the one scripted move: the opening's double) / Pick how the tile faces, then place it. / Close a road or a river to clear its tiles. / Place every tile to win. Keep room on the board! (any move) |
| Packs           | Country lanes, River bends, Crossroads                                                                                                                                                                                                   |

## 17. The Toybox design pass (palette, logo, texts)

- **Palette ("a trail map"):** light ground Trail sand `#F3D6A4`, surface Map paper, accent River
  blue, pop Moss; dark ground Campfire night with Glow river and Glow moss. Final values are the
  ones `write-palette.mjs --dry-run` passed (in `reports/trail-clear/trail-clear-paint.json` and
  `color.games.trailClear` of `design/toybox/tokens.json`).
- **Logo (48-unit grid):** four white tiles in a 2 × 2 square (`w`), a pop loop road with ink
  edges running through all four (`p`, a ring), and ink road dashes on it (`kl`): three layers.
- **Design file:** Trail Clear joins `design/toybox.html` (game switcher, palette, logo, sample
  statistics, how-to-play picture), `design/toybox/tokens.json` and `design/shared/copy-deck.json`
  next to Line Siege, Flock Tilt and Scrap Shove.

## 18. Store facts (from App Store Connect, 2026-10-19)

App Store name "Trail Clear", Apple ID 6824609157, bundle id `io.applander.trailclear` (O4),
Premium `io.applander.trailclear.premium` at EUR 1.99, Family Sharing off (O2, O3).
