# Merge Siege: design notes

Game 5 of the catalogue (`merge-siege`), written 2026-10-19 before any code (new-game step 1). Every
answer below is a proposal with its reason and what changes if the owner answers differently. The
spec lines are quoted from `spec-lookup.mjs merge-siege 13 12 10 11 8.1 8.2 8.3 8.5 8.10 D2 D9`.

## What it is

Spec 13 (catalogue entry 5): "2048-style swipe merging while numbered enemies march in; bigger tiles
smash smaller enemies." Swipe to slide and merge every tile; enemies step in from the top edge as
you swipe; a tile that meets a smaller enemy smashes it.

The board is 5 columns by 6 rows (the toy's size). Your tiles are white numbered squares (2, 4, 8,
...). Enemies are spiky numbered shapes that enter at the top row and march down. The bottom row is
your base: an enemy that reaches it has overrun the board.

## The problem the toy found, and the design fix (decided first)

Spec 13: "Problem: clashes felt like trades. All tiles move at once, so most clashes become
one-for-one trades; every simulated run ended "Overrun" in about 15-20 moves. 2048 variants are
saturated in the stores."

The toy's rules: equal numbers cancel (both die), the winner of a clash stops, enemies step every
swipe, a new enemy enters every swipe. A scratch reproduction of those rules (150 seeds, a greedy
one-move bot) wins 1 % of 20-enemy runs and is overrun after a median of 4 swipes.

The fix, four rule changes with numbers:

1. **Ties go to your tile.** A tile smashes an enemy with the same number or a smaller one; only a
   bigger enemy beats it. No more one-for-one cancels.
2. **A winning tile ploughs on.** A tile that smashes an enemy takes its cell and keeps sliding, so it
   can smash the next enemy behind it too. Merging first pays off: one merged 8 clears a column of
   2s, 4s and 8s in one swipe. This is the twist: one swipe smashing two or more enemies.
3. **The enemies march every second swipe** in the level rows (a tuning knob, `marchEvery` 2; the
   toy marched every swipe), so the player gets one free swipe to set up a merge.
4. **A prepared opening.** Every level starts with two weak enemies (2s) in rows 1 and 2 above two
   of your tiles, plus a mergeable pair, so the first swipe up smashes both (the first payoff and
   the twist in the very first move, as Line Siege's prepared opening fires a beam on move 1).

Kept from the toy, as the epic asks: a tile that runs into a bigger enemy is lost (the enemy stays),
and an enemy that marches into a tile smashes it when it is bigger (and is smashed when it is not).

Measured on a scratch prototype of these rules (150 seeds per cell, the same greedy one-move bot,
the lookahead bot two moves deep):

| Row         | Enemies | Values            | Random wins | Greedy wins | Lookahead wins | First smash within 3 swipes (greedy) | Multi-smash swipes per run (greedy, median) |
| ----------- | ------- | ----------------- | ----------- | ----------- | -------------- | ------------------------------------ | ------------------------------------------- |
| 0 (easiest) | 8       | 2, 4, 8 (2:2:1)   | 32 %        | 77 %        | 97 %           | 100 %                                | 2                                           |
| 1           | 14      | 2, 4, 8 (2:3:2)   | 12 %        | 61 %        | 93 %           | 100 %                                | 3                                           |
| 2           | 16      | 2 to 16 (2:2:2:1) | 2 %         | 15 %        | 33 %           | 100 %                                | 2                                           |

Skill matters (random below greedy below lookahead), the first payoff comes at once, and the twist
fires every run. These are prototype numbers; E22-T06 tunes the real rules with the real bots.

**Go or no-go:** the kill test in E22-T06 decides (first smash within 1 to 3 swipes in at least 90 %
of easy greedy runs, and at least one multi-smash swipe per run). If it fails after reasonable
tuning, Claude stops and asks the owner: change a rule, or drop the game.

**Store risk, named for the owner:** 2048 variants are saturated in the stores, and store review may
see "another 2048". The marching enemies, the plough and the siege look must stay the headline in
the store listing (G8).

If the owner answers differently: a rejected fix means the epic closes as dropped (E22-T06's Owner
line); a different fix (for example a shield row) changes the rules in E22-T04/T05 test-first.

## Classification

Turn-based (game-rules-engine, "Classifying a game"): apply the move, then animate its events. Every
draw (new tiles, the next enemy) comes from the seeded sfc32 RNG kept in the state. No real-time
phase, no simulate-then-replay.

## Input

A 4-way swipe: `engine.panMode` `'swipe'`, `selectRegions` `[]` (board-gestures-and-input's input
table; the same as Flock Tilt). One finger and no gesture also works: a tap on a side of the board
slides the tiles that way (the toy did this; it is the one-handed and VoiceOver way and the way the
E2E flows play, because Maestro has no swipe). VoiceOver users get the four swipes as accessibility
actions on the board. A swipe that moves nothing does nothing (`intentToMove` returns `null`).

If the owner prefers swipes only: drop the side taps; the E2E flows then need another way to move.

## Modes

Spec 8.2: "LEVELS Always on; DAILY One generated level per day (8.3). On by default; ENDLESS For
games with no natural end ... play until you lose, beat your best. Optional per game."

Levels + Endless + Daily. The daily is on (default). Endless is `create(seed, 100)`, never won, with
its best on Home ("Endless – Best 4,210"). Reason: the siege has no natural end, like Line Siege.

## Packs

Spec D9: "3 packs x 30 levels, plus Daily; Endless where it fits." Three packs of 30 levels on the
0 to 99 difficulty scale, rising, unlocked by stars (S8: 0, 45, 90 stars). Pack names: "Outer gate",
"Inner wall", "Grand keep" (in four languages in the copy deck).

## Stars

Spec 8.1: "Score games: 3 / 2 / 1 stars at score thresholds." Merge Siege is a score game: one star
for winning, two at the witness bot's score, three above it (level-generation-and-solvers' witness
rule). S7 shows the score line "Score 1,840 – best 1,840" (L3, the `s7-result-win--score` frame).

Score: an enemy smashed scores 10 times its number; a merge scores the new tile's number (2048's
rule). Whole numbers, never negative.

## Undo

None. Spec 8.5: "Undo: if the game supports it ... (unlimited in puzzle games; the game can limit
it)." Every move is final, which keeps scores honest (the next enemy and the new tile are drawn from
the seeded future, so undo would let a player fish for good draws). `rules.undo` is `none`.

## Hints

None. Spec 8.5: "A game without hints (for example Line Siege) shows no hint key on the Game screen
and no hint entry in the Pause menu (lead decision L8)." No exact solver exists (the future is
drawn at random); levels are proven by a witness bot, which never gives hints. `hints.freePerDay` 0,
`hasHints` false.

## Continue

Spec 8.10: "Games may allow one continue per level or run: for example the monsters are pushed back
one row ... Cost: a rewarded ad, or free with Premium. Offline and not Premium: no continue. When no
continue can be offered, the result appears at once (S7)."

`once`: every enemy is pushed back one row (an enemy already in the top row is driven off the
board; a tile in the way swaps down into the enemy's old cell, so no tile is lost). If no tile is
left on the board, a fresh 2 drops into the middle of the bottom row so the run can go on. A rewarded
ad, or free with Premium (D2); while the ad loads the offer shows busy, and a hidden offer means
none, so the result shows at once (L11). A second continue in the same run is refused.

## Ways of losing

One reason: `merge-siege.lose.overrun` ("The enemies overran the board"). It happens when an enemy
reaches the bottom row, and also in the rare case that no swipe can move anything (the board is
jammed). The rules keep a jam nearly impossible: a new tile appears only while the board has at least
two empty cells.

## Counters

Spec 10: "2-4 game-specific counters with labels in 4 languages."

| Counter         | Id                | Aggregate | Measured from                       |
| --------------- | ----------------- | --------- | ----------------------------------- |
| Enemies smashed | `enemies-smashed` | sum       | every `enemy-smashed` event         |
| Tiles merged    | `tiles-merged`    | sum       | every `tiles-merged` event          |
| Biggest tile    | `biggest-tile`    | max       | the largest tile value a merge made |

## Music

None. Sound effects only (slide, merge, smash, march, win, lose), so S6 and S11 drop the Music rows
and parity uses the `--no-music` references (L1).

## Age rating

Cartoon or fantasy violence: `INFREQUENT_OR_MILD` (step G1): tiles smash cartoon enemies, as Line
Siege's beams hit monsters.

## Bands (proposed; the owner's play-test approves them later, O6)

The difficulty curve over the four tuning rows (0-24, 25-49, 50-74, 75-99): the greedy bot's win
rate falls by at least 0.1 per row (target about 0.8, 0.6, 0.4, 0.2); random play mostly loses
(at most 0.35 of the easiest level); the lookahead bot beats greedy by a clear step at difficulty 25.
A level lasts a minute or two (median 10 to 40 swipes). The endless run is never won and outlasts a
level.

Kill test (game-balance-and-bots rule 9): on the easiest level the first enemy is smashed within 1
to 3 swipes in at least 90 % of greedy runs (payoff event `enemy-smashed`), and one swipe smashes two
or more enemies at least once per run (twist: a swipe with two or more `enemy-smashed` events).

## Rules v1 in full (every number a tuning knob)

- Board 5 x 6. Tiles and enemies carry a power-of-two number.
- A turn: (1) every tile slides in the swipe direction, 2048-style, nearest the far wall first; two
  equal tiles merge once per swipe; a tile meeting an enemy smashes it (tile >= enemy) and ploughs on,
  or is lost (tile < enemy); (2) on every `marchEvery`-th swipe every enemy steps one row down
  (bottom first), smashing a smaller tile in its way or being smashed by an equal or bigger one, and
  waiting behind another enemy; (3) on every `spawnEvery`-th swipe the next enemy (shown above the
  board as "Next") enters the top row of its column, while the level's wave lasts; (4) a new 2 (or a
  4, one time in ten) appears in a random empty cell of the bottom two rows while the board has at
  least two empty cells.
- Won: the level's wave has entered and every enemy is smashed. Lost: an enemy on the bottom row, or
  no move left.
- Endless (difficulty 100): the wave never ends and the enemies' numbers step up one size every 20
  swipes.
- The daily uses the scaffold's salt `0x7403` (29699) at difficulty 45 (spec 8.3: "a medium
  difficulty").

## The Toybox design pass

Merge Siege joins the Toybox design as a design game (spec 13: "Each game gets its own design pass,
approved by the owner, before it is built"):

- **Palette:** light "Peach wash" ground `#FFD6B8`, "Cream" surface `#FFFBF7`, "Grape" accent
  `#A98BFF`, "Mint" pop `#63DDB0`; dark "Plum night" `#2B1838`, "Plum lid" `#3F2550`, "Glow grape"
  `#B9A0FF`, "Glow mint" `#74EBC0`, ink "Moonlight" `#FBF4FF`, "Lavender dusk" `#B49CC8`. It passes
  the Toybox contrast rules (`write-palette.mjs --dry-run` prints `RESULT: PASS`).
- **Logo** (48-unit grid, five layers): a white spiky enemy with ink eyes, a white tile with two ink
  up-chevrons smashing into it, and a mint spark where they meet.
- **Texts** in en, de, fa and ckb: name, tagline, goal, progress line, win title, the lose reason,
  the three counter labels, four how-to-play steps, four tutorial steps and three pack names, added
  to `design/shared/copy-deck.json`. The fa and ckb texts are drafts for the owner's own review (O6).

If the owner wants other colours or another logo: the design files change in a new design pass
(E22-T02 step 3 records it as a `referenceChanges` entry), then the palette and logo are regenerated.
