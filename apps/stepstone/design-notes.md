# Stepstone: design notes

Game 7 of the catalogue (spec 13), game id `stepstone`. Written 2026-10-19 for the owner's one
approval message (E24-T01). Every answer below is a proposed default with its reason and what
changes if the owner answers differently. Claude builds with these defaults meanwhile; a later
answer becomes a test-first change in the layer it touches.

The spec lines these notes serve, printed with `spec-lookup.mjs stepstone 13 12 10 11 8.1 8.2 8.3
8.5 8.10 D2 D9` (never from memory):

- spec 13, catalogue entry 7: "Small-grid tactics where the tile the player stands on sets the next
  move (knight, rook, bishop...). Risk: 6-8 move glyphs are hard to read on a phone; chess
  roguelites are crowded."
- spec 8.1: "Levels are generated from a seed number plus a difficulty, not drawn by hand. [...]
  each level is checked by a solver before it ships, so no level is impossible, and the solver also
  calculates "par"" and "Puzzle games: 3 stars at or under par, 2 stars at par +2, 1 star for
  finishing."
- spec 8.2: "LEVELS Always on", "DAILY One generated level per day (8.3). On by default", "ENDLESS
  For games with no natural end [...] Optional per game".
- spec 8.3: "The level number comes from today's local date plus the game's own salt, run through
  the same generator as normal levels, at a medium difficulty."
- spec 8.5: "Undo [...] unlimited in puzzle games" and "Hints [...] The game's solver suggests the
  next good move, and the Shell highlights it. Hint budget: 1 free hint per day, then a rewarded ad
  per hint, or unlimited with Premium (decision D2)."
- spec 8.10: "When no continue can be offered, the result appears at once (S7)" (lead decision L11).
- D2: "removes all ads, and hints and continues become free. Levels are never sold."
- D9: "3 packs x 30 levels, plus Daily; Endless where it fits."
- spec 10 and 11: the game contract and the per-game configuration (identity, rules, levels, board
  and controls, teaching, statistics, texts, testing; ids, modes, packs, free hints, continue).

## What it is

**Proposed:** a frog hops across stepping stones in a small pond. Every stone shows a hop glyph,
and the stone the frog stands on sets its next hop: a plus stone hops in a straight line any
distance, an × stone hops corner to corner any distance, a ring stone hops one square any way, an
L stone leaps like a chess knight. Tap a stone your hop reaches; the frog lands, takes that
stone's hop, and the stone it left sinks behind it. Reach the flag stone. Run out of stones in
reach and the level is lost (undo is the way out).

**Why:** this is spec 13's entry ("the tile the player stands on sets the next move (knight, rook,
bishop...)") with one rule added that makes it a puzzle with a real way of losing: stones sink
once left, so wandering burns the route. Sinking never changes the shortest route (a shortest
route never visits a stone twice), so the solver stays exact and fast. The frog gives the board a
character a player names at a glance and a logo that reads at icon size.

**Glyphs (the idea hunt's risk):** v1 caps the hop kinds at four, each a different shape that
reads at 44 pt and without colour: ring (one step, the king), plus (straight line, the rook),
× (diagonal, the bishop), L (the knight leap). Shape first, colour second, so the colour-blind
palettes stay readable (spec 8.11). No queen and no other chess pieces in v1.

**If the owner answers differently:** without sinking stones the game has no way of losing and the
bots cannot tell skill apart (random play always wins eventually); a different set of hop kinds is a
tuning change (`stepstone-tuning.ts`) plus new glyphs in the board code.

## Classification

**Proposed:** turn-based: `applyMove` returns the next state and its events, then the board
animates the events (game-rules-engine, "Game classes"). Nothing moves on its own; the rules draw
no random numbers after `create`, so the state carries no `rng`.

**Why:** one tap is one complete hop; there is no clock and no opponent.

## Input

**Proposed:** a tap on a stone the current hop reaches, `engine.panMode: 'none'`, no select
regions (`selectRegions: []`). Reachable stones are highlighted on the board; a tap anywhere else
does nothing (`intentToMove` returns `null`).

**Why:** the move is "where to land", one cell; a swipe or drag would add nothing. A tap on a
44 pt cell is the most reliable input on a phone (S5, 8.11). The largest grid is 7 x 7, so a cell
is at least 53 pt wide in the 374 pt board area.

## Modes

**Proposed:** Levels + Daily (8.2): daily on, no Endless, so Home shows no Endless card.

**Why:** a level ends at the flag; an endless pond has no natural goal, and D9 says "Endless where
it fits".

**If the owner answers differently:** an endless run would need a score (stones crossed before
getting stuck) and its own tuning row at difficulty 100.

## Packs

**Proposed:** 3 packs of 30 levels (D9), unlocked by stars as S8 says (0, 45 and 90 stars by
default), named:

| Pack | en           | de             | fa (draft)    | ckb (draft)  |
| ---- | ------------ | -------------- | ------------- | ------------ |
| 1    | Lily pond    | Seerosenteich  | برکهٔ نیلوفر  | گۆمی نیلۆفەر |
| 2    | Misty creek  | Nebelbach      | نهر مه‌آلود   | جۆگەی تەماوی |
| 3    | River rapids | Stromschnellen | تندآب رودخانه | خوڕی ڕووبار  |

**Why:** the pond grows from a calm pond to a river: bigger ponds, longer routes, more traps, all
four hop kinds.

## Stars

**Proposed:** the puzzle rule of spec 8.1 through game-kit's `starsFor`: 3 stars at or under par,
2 stars up to par + 2, 1 star for reaching the flag. S7 shows "7 moves – par 7" (the base
`s7-result-win` reference, `winLine: "moves"`). Par is the solver's shortest number of hops.

## Undo

**Proposed:** unlimited (`undo: { kind: 'unlimited' }`), a puzzle game (8.5). Undo is the way out
of a dead end. There is no continue, so undo never crosses one.

## Hints

**Proposed:** `solver`: the solver's next hop on a shortest route from the current state,
highlighted on the board (`highlight.hinted`); 1 free hint a day, then a rewarded ad per hint,
unlimited with Premium (8.5, D2). `hints.freePerDay: 1`, game fact `hasHints: true`, so S5 shows
the hint key. From a state with no route left (a dead end ahead) there is no hint: the player
undoes.

## Continue

**Proposed:** `none` (`rules.continueRun: { kind: 'none' }`, `isContinueAllowed: false`): S7
offers no continue and the result shows at once (8.10, L11).

**Why:** undo already rescues a stuck frog for free; a paid continue would sell what undo gives.

## Ways of losing

**Proposed:** one way, `stepstone.lose.stuck`: no stone is in reach of the current hop (every
target is water, a sunk stone or off the pond). S7's short reason: "No stone can be reached".

## Counters (2 to 4)

| Counter id      | Label (en)     | Aggregate | Counted from                                                                       |
| --------------- | -------------- | --------- | ---------------------------------------------------------------------------------- |
| `tiles-stepped` | Stones stepped | sum       | one per `player-stepped` event                                                     |
| `levels-at-par` | Levels at par  | sum       | a `goal-reached` event whose moves are at or under par                             |
| `kinds-used`    | Hop kinds used | max       | distinct hop kinds the frog landed on in the run (S10 draws a max counter as "×4") |

## Music

**Proposed:** none (8.7, L1). S6 and S11 drop the Music rows; parity uses the `--no-music`
references (`s6-pause--no-music`, `s11-settings--no-music`, `s14-reset-all-progress--no-music`).
The sound bank is short synthesised sounds: hop, kind change, stone sinking, win, stuck.

## Age rating

**Proposed:** cartoon or fantasy violence `NONE` (owner step G1): a frog hops on stones; nothing
is hit or hurt.

## Rules in detail

- **Pond:** a square grid, side 5, 6 or 7 by tuning row. Each cell is water or a stone; one stone
  is the start (the frog), one is the flag. Every other stone carries one hop kind.
- **Hops:** ring = the 8 neighbours; plus = every cell in the same row and column (any distance,
  over water and stones); × = every cell on both diagonals (any distance); L = the 8 knight
  offsets. A target must be a live stone (not water, not sunk, inside the pond).
- **A hop:** the frog lands on the target, takes its kind, and the stone it left sinks. Landing on
  the flag wins.
- **Generation (`create(seed, difficulty)`):** a route of `routeHops` hops is laid first from
  the seeded start, each hop with a kind drawn from the row's kinds (a different kind than the hop
  before, when one fits) and landing on a fresh cell, so every pond is solvable by construction.
  Then up to `decoys` two-stone traps are laid beside the route, nearer the flag, where a route
  stone's hop reaches them: a lure stone that looks like a step forward and whose only hop leads to
  a stone that strands the frog. Every other cell is open water. Par is the shortest route (BFS
  over stones); a pond shorter than the row's `minPar` is laid again (at most 24 times).
- **Events (past tense):** `player-stepped` (from, to, kind used, kinds used so far),
  `stone-sank` (cell), `move-kind-changed` (from kind, to kind, whether the kind is new this run),
  `goal-reached` (cell, moves, par), `frog-stranded` (cell, when no stone is left in reach).
- **Outcome:** won on the flag (score = moves made, never negative); lost with `stepstone.lose.stuck`
  when no stone is in reach; otherwise playing.

## Bands (proposed; set from the first sim run in E24-T06)

**Proposed curve:** four tuning rows on the 0 to 99 scale (`[0, 25, 50, 75]`):

| Row   | Pond  | Hop kinds     | Laid route | Traps tried | Fewest hops |
| ----- | ----- | ------------- | ---------- | ----------- | ----------- |
| 0-24  | 5 x 5 | plus, ring    | 4 hops     | 4           | 3           |
| 25-49 | 5 x 5 | plus, ring, × | 5 hops     | 5           | 4           |
| 50-74 | 6 x 6 | all four      | 6 hops     | 7           | 5           |
| 75-99 | 7 x 7 | all four      | 7 hops     | 9           | 6           |

A first probe of these rules (100 ponds per row, before any code was committed) showed why the traps
are needed: with stones scattered at random, random tapping won 40 to 68 % of ponds and a one-hop
greedy player about 100 %, with no gap to a player looking several hops ahead. With the route plus
two-stone traps, random tapping won 70, 51, 17 and 14 % by row, the greedy player 79, 65, 35 and
21 %, and a three-hop lookahead 100, 100, 94 and 88 %. The real sims (E24-T06) set the bands.

- Random play gets stuck often and wins clearly less than a reasonable player; the greedy bot (one
  hop ahead, heading for the flag by straight-line distance and keeping stones in reach) wins most
  easy ponds and fewer hard ones; the lookahead bot (several hops ahead) wins more than greedy.
- The greedy bot does not use the solver's exact distance: with it, one hop of lookahead would
  already play perfectly and no skill gap could show. A person judges "closer to the flag" by eye,
  and so does the bot.
- Exact bands, the skill gap and the curve's step are written from the measured numbers, with a
  margin, and stay `"proposed"` until the owner's play-test (O6).

**Kill test (fun within seconds):** the payoff is the flag or a new hop kind reached, tagged on
`goal-reached` and `move-kind-changed`; on the easiest level the greedy bot must reach it within
1 to 3 hops in at least 90 % of runs. The twist is a hop kind chained into another
(`move-kind-changed`), at least once per greedy run. If either fails after reasonable tuning, the
owner gets one stop-and-ask message (E24-T06).

## Daily

**Proposed:** the daily plays the generator at difficulty 45 (a medium pond of the second row) with
Stepstone's own salt `0x0eb2` (the scaffold's suggestion for the id stepstone), fixed forever in E24-T07 (8.3).

## Statistics and texts

All texts are in the copy deck under `games.stepstone` in en, de, fa and ckb (fa and ckb are drafts
for the owner's own review, O6, step G7): name (Stepstone, Latin in every language), tagline, goal,
progress line, win title, lose reason, three counter labels, four how-to-play steps, four tutorial
lines and three pack names.

## The Toybox design pass

- **Palette** (`reports/stepstone/stepstone-paint.json`, checked by `write-palette.mjs --dry-run`):
  light: Lilac pond ground `#CFC7F6`, Pebble surface `#FBFAFF`, Lily pad accent `#27A776`, Lotus
  pop `#FF8DB5`; dark: Night pond ground `#142238`, Wet stone surface `#213452`, Glow pad accent
  `#45D6A0`, Night lotus pop `#FF9DC2`.
- **Logo** (48-unit grid, 7 layers): a white frog with ink eyes and smile sitting on a lotus-pink
  stone; never mirrored.
- **How-to-play picture:** a 5 x 4 pond with plus, ×, ring and L stones, the frog on a plus stone,
  its reachable stones outlined, a sunk stone behind it and the flag.
- **Sample statistics (S10):** 1342 stones stepped, 46 levels at par, ×4 hop kinds.
</content>

</invoke>
