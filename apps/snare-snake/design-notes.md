# Snare Snake: design notes

Game id `snare-snake`, catalogue number 4 (spec 13). Written 2026-10-19 for epic E21, before any code
(new-game-scaffold "Before code"). Every answer below is a proposal with its reason; the owner approves
them in one message, and until then the proposed answers apply. An answer that changes later becomes a
test-first change in the layer it touches.

The spec lines these notes serve were printed with
`node skills/pocket-arcade-product-spec/scripts/spec-lookup.mjs snare-snake 13 12 10 11 8.1 8.2 8.3 8.5 8.10 D2 D9`
and are quoted, never paraphrased:

- spec 13 (snare-snake): "Turn-based Snake where crossing the snake's own body closes a loop, captures
  critters inside and spends those segments."
- spec 13 (snare-snake): "Problem: catching took too long in the toy. Enclosing even one cell takes an
  8-segment ring, so the starting snake (length 5) cannot catch anything, and critters slip out while the
  loop is drawn. A greedy bot caught 1 critter in 20,000 moves. This is structural friction, not a tuning
  number."
- spec 13: "Each game gets its own design pass, approved by the owner, before it is built."
- spec 8.1: "Score games: 3 / 2 / 1 stars at score thresholds."
- spec 8.2: "DAILY | One generated level per day (8.3). On by default"; "ENDLESS | For games with no natural
  end ... Optional per game".
- spec 8.3: "The level number comes from today's local date plus the game's own salt, run through the same
  generator as normal levels, at a medium difficulty."
- spec 8.5: "A game without hints (for example Line Siege) shows no hint key on the Game screen and no hint
  entry in the Pause menu (lead decision L8)."
- spec 8.10: "Games may allow one continue per level or run"; "Cost: a rewarded ad, or free with Premium.
  Offline and not Premium: no continue."; "When no continue can be offered, the result appears at once (S7)".
- D2: "removes all ads, and hints and continues become free. Levels are never sold."
- D9: "3 packs x 30 levels, plus Daily; Endless where it fits."

## What it is

**Proposed:** Turn-based Snake where crossing the snake's own body closes a loop, captures the critters
inside it and spends those segments. Swipe to turn; each turn the snake moves one cell and the critters
move; closing a loop captures every critter inside and the snake loses the segments the loop used.

**Why:** this is the catalogue's entry; the design fix below changes the numbers and two critter rules, not
the idea.

**If the owner answers differently:** a different core idea is a new game, not a change to this one; the
epic would close as dropped (E21-T06's Owner line).

## The design fix (the go or no-go)

The toy failed on structure: catching took 30 to 60+ taps, a greedy bot caught 1 critter in 20,000 moves.
Four changes, each aimed at one cause the toy found:

| Cause in the toy                                            | Fix                                                                                                                                                             | Number (easiest row)                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The starting snake (length 5) cannot make an 8-segment ring | A longer start, curled: the snake starts coiled in a C around a nest of critters, two cells of the ring still open in front of its head                         | length 10; gap 2, so the first catch is 3 moves away                          |
| Critters slip out while the loop is drawn                   | Critters keep their distance and freeze when touched: a critter never hops onto a cell next to the snake, and a critter next to the snake does not move at all  | critters hop every 2nd turn on the two easy rows, every turn on the hard rows |
| An enclosing ring is long and costly                        | A loop catches every critter inside it **or touching it** (sharing a side with one of the loop's cells): a tight 4-cell curl next to a frozen critter snares it | the smallest loop (a 2 x 2 curl) spends 3 segments                            |
| Spending segments starves the snake                         | The snake grows: one segment every 3 moves, and 2 more for every critter caught                                                                                 | grow every 3 moves (every 4 on the hardest row); +2 per critter               |

**Measured on a scratch prototype of these rules** (not committed; 100 seeds per cell, the template's
greedy, random and lookahead players; the real numbers come from E21-T06's sims):

| Difficulty | random wins | greedy wins | lookahead wins | greedy: first catch within 3 moves | greedy: multi-critter loops per run |
| ---------- | ----------- | ----------- | -------------- | ---------------------------------- | ----------------------------------- |
| 0          | 7 %         | 100 %       | 100 %          | 99 %                               | 1.20                                |
| 25         | 0 %         | 92 %        | 99 %           | 81 %                               | 0.97                                |
| 50         | 0 %         | 72 %        | 81 %           | 82 %                               | 1.12                                |
| 75         | 0 %         | 55 %        | 73 %           | 76 %                               | 1.30                                |

Without the "touching" capture the same prototype's greedy player caught about 1.4 critters per run and
won 37 % of the easiest level and almost none of the others: the touching rule is the part of the fix that
makes catching reachable for a reasonable player, the coiled start is what makes it immediate.

**The kill test in E21-T06 is the go or no-go:** on the easiest level the greedy bot's first critter is
caught within 1 to 3 moves in at least 90 % of runs, and a loop catches more than one critter at least once
per run. If it fails after reasonable tuning, the owner decides between a rule change and dropping the game.

## The rules (v1, every number a default until the owner's play-test)

1. **Board:** a grid of cells, 7 x 8 on the easiest row up to 8 x 10 on the hardest (every cell at least
   44 pt on a phone). The board is a physical space and never mirrors in fa and ckb (spec 7.5).
2. **Snake:** a chain of segments, head first, starting coiled in a C around a nest (1 x 1 or 2 x 1 cells)
   with the nest's critters inside and two ring cells open in front of the head; the rest of the body trails
   away from the ring. Length 10 at the start.
3. **A move:** swipe up, down, left or right; the head moves one cell that way. Not allowed: back onto the
   neck, off the board, onto a critter. `listMoves` lists the allowed directions in the fixed order up,
   right, down, left.
4. **Closing a loop:** moving the head onto any other segment of the snake closes a loop made of the cells
   from the head to that segment. Every critter inside the loop, or sharing a side with one of its cells,
   is caught. The loop's segments are spent: the bitten segment becomes the head and the snake keeps only
   what was behind it.
5. **Growing:** one segment every 3 moves (4 on the hardest row) and 2 segments for every critter caught;
   new segments appear at the tail over the next moves.
6. **Critters:** after the snake moves, on a hop turn (every 2nd move on the easy rows, every move on the
   hard rows), each critter that is not next to the snake draws one of four directions from the run's
   seeded RNG and hops there when that cell is on the board, empty and not next to the snake; otherwise it
   stays. A critter next to the snake freezes. The RNG state lives in the game state (spec 8.13).
7. **Winning:** every critter of the level is caught. **Score:** each loop scores 10 x n x n for n critters
   (1 critter 10, 2 critters 40, 3 critters 90), plus 5 per move left at the win.
8. **Losing:** the move budget is spent (27 to 34 moves by row) or the snake is tangled
   (no allowed move: walls and critters on every free side).
9. **Continue (once per run, after a loss):** the snake gets three more moves; when it was tangled, it also
   steps back one cell (its head segment is removed, so the cell it came from is free again).

Tuning rows (`apps/snare-snake/src/rules/snare-snake-tuning.ts`, four rows on the 0 to 99 scale, the
lower bound of each row in brackets), as tuned in E21-T06 (the second row went from 30 to 27 moves so the greedy
win rate falls by at least 0.1 per row):

| Row    | Board  | Critters (in the nest) | Moves | Critters hop   | Grow every |
| ------ | ------ | ---------------------- | ----- | -------------- | ---------- |
| 1 (0)  | 7 x 8  | 4 (2)                  | 30    | every 2nd move | 3 moves    |
| 2 (25) | 7 x 9  | 5 (1)                  | 27    | every 2nd move | 3 moves    |
| 3 (50) | 8 x 9  | 6 (1)                  | 32    | every move     | 3 moves    |
| 4 (75) | 8 x 10 | 7 (1)                  | 34    | every move     | 4 moves    |

## Classification

**Proposed:** turn-based: apply the move, then animate its events (game-rules-engine's classification;
the catalogue's own table lists Snare Snake as turn-based).

**Why:** nothing moves between swipes; critters hop as part of the move, drawn from the RNG in the state,
so bots, the witness solver, saves and replays stay exact.

**If different:** a real-time snake would be a different game (and the least testable class); not proposed.

## Input

**Proposed:** a 4-way swipe moves the snake one cell (`engine.panMode` `'swipe'`). The same moves also work
without a gesture: a tap on the board moves the snake one cell toward the tapped cell (along the longer
axis from the head), which is the one-finger way, the E2E flows' way, and VoiceOver users get the four
directions as accessibility actions on the board.

**Why:** spec 13's toy was "tap or swipe to steer one step at a time"; swipes are among the safe inputs
(spec 13 research: "taps and swipes are safer than virtual sticks"), and the tap fallback keeps the game
playable with one finger in portrait (8.11).

**If different:** a tap-only game keeps `panMode` `'none'` and drops the swipe tests; nothing else moves.

## Modes

**Proposed:** Levels + Daily (spec 8.2: Levels "Always on", Daily "On by default"); no Endless, so Home
shows no Endless card.

**Why:** every level ends (all critters caught, or the moves run out), so there is no natural endless run;
Endless is "Optional per game".

**If different:** an endless mode needs an endless tuning row (difficulty 100, never won, rising pressure)
and its own sim block.

## Packs

**Proposed:** 3 packs of 30 levels (D9), unlocked by stars (S8), difficulty rising from 0 at level 1 to 99
at level 90. Pack names: "Garden patch", "Mossy rocks", "Bramble wood" (in four languages, below).

**Why:** the D9 default; the names follow the critters' habitats from easy to hard.

**If different:** the level plan and the generated packs change (a Gate-Change commit); nothing else.

## Stars

**Proposed:** score thresholds per level (spec 8.1, score games: "3 / 2 / 1 stars at score thresholds"),
set from the witness's score on that level with the level skill's margins; S7 shows the score line
"Score 1,840 – best 1,840" (L3, the `s7-result-win--score` reference).

**Why:** the RNG decides how critters hop, so there is no exact par; a score rewards fewer moves and bigger
loops, which is the skill the game teaches.

**If different:** a moves-against-par rule would need an exact solver, which the critters' random hops
rule out.

## Undo

**Proposed:** none: every move is final (8.5 lets the game limit undo).

**Why:** the critters hop from the run's RNG, so an undo would let a player re-roll the critters until a
loop lands; no undo keeps scores honest.

**If different:** an unlimited undo is `rules.undo` `unlimited` and a Shell-side history; the score would
need to ignore undone moves (the Shell already folds only the kept move line).

## Hints

**Proposed:** `none`: no hint key on S5 and no hint entry on S6 (8.5, L8); `hints.freePerDay` 0,
`hasHints` false.

**Why:** a hint needs a solver that proves the next good move; the witness is a reasonable player, not a
solver, so a hint could be wrong.

**If different:** `--hints solver` and a suggestion function; parity would then use the hint-key frames.

## Continue

**Proposed:** `once`: the snake is untangled one step back and gets three more moves; a rewarded ad, or free
with Premium (D2); offline and not Premium, none (8.10); while the ad loads the offer shows busy, and a
hidden offer means none, so the result shows at once (L11).

**Why:** both ways of losing end close to a win; three moves are enough to close one more loop, never
enough to finish a level from scratch. Stepping back always frees a way out, because the cell the head came
from is empty (critters never hop next to the snake).

**If different:** `--continue none` removes the offer; S7 then shows the result at once.

## Ways of losing

**Proposed:** `snare-snake.lose.tangled` ("The snake got tangled") and `snare-snake.lose.out-of-moves`
("You ran out of moves"), short and friendly (S7).

**Why:** the two ways the rules can end a run without a win.

**If different:** each new way of losing is one more `snare-snake.lose.<reason>` key in four languages.

## Counters (2 to 4)

**Proposed:** Critters caught (`critters-caught`, sum), Loops closed (`loops-closed`, sum), Longest snake
(`longest-snake`, max).

**Why:** the three things a player of this game is proud of; each is counted from one move's events
(`critters-caught`, `loop-closed`, the snake's length on `snake-moved` and `loop-closed`).

**If different:** counter ids are permanent save keys, so a change before the first release only.

## Music

**Proposed:** none, so S6 and S11 drop the Music rows and parity uses the `--no-music` references (L1).

**Why:** a short synthesised sound per event (move, loop closed, capture, win, lose) carries the game.

## Age rating

**Proposed:** cartoon or fantasy violence `NONE` (step G1).

**Why:** critters are snared and vanish in a sparkle; nothing is hit or hurt on screen.

## Bands (the sims' targets, status "proposed" until the owner's play-test)

- Greedy wins about 85 to 100 % of the easiest level (a warm-up row) and 35 to 75 % of the hardest; the win
  rate falls row by row.
- Random play wins at most 30 % of the easiest level ("naive play should lose").
- Skill matters: random < greedy < lookahead by a clear step on the hardest row (prototype: 0 %, 55 %, 73 %).
- A level lasts about 15 to 40 moves (prototype medians 15 to 33).
- **Kill test:** on the easiest level the greedy bot's first critter is caught within 1 to 3 moves in at
  least 90 % of runs (`critters-caught`, the payoff), and a loop catches more than one critter at least once
  per run (`critters-caught` with a count of 2 or more, the twist).
- Daily: difficulty 45 (the second row), with the salt the scaffold suggests (fixed forever in E21-T07).

## The Toybox design pass

Snare Snake is not in the Toybox design yet. This pass draws it there (E21-T01) and the skill library learns
it as a design game (E21-T02):

- **Palette** (`reports/snare-snake/snare-snake-paint.json`, passes `write-palette.mjs --dry-run`):
  light "Lilac wash" `#C9B8F0` ground, "Petal" `#FCFAFF` surface, `#EAE3FB` sunken, "Snake green"
  `#3FA34D` accent, "Berry" `#FF6F9F` pop; dark "Jungle night" `#10302B` ground, "Fern" `#173E36` surface,
  `#14372F` sunken, "Moonlight" `#F0FFF9` ink, "Mist" `#8FBFAE` muted, `#D4F7EA` outline, `#04120F` shadow,
  "Glow green" `#6CCB5F` accent, "Glow berry" `#FF8DB8` pop. The first draft failed `palette-contrast` twice
  (danger text on the light sunken 4.28:1 and on the dark surface 4.29:1); the light sunken moved lighter
  and the dark surface and sunken darker.
- **Logo** on the 48-unit grid: a white snake curled into a closed ring (four segment lines), its head
  overlapping the ring at the top end with one eye and a berry tongue, and a berry ladybird critter inside
  the loop.
- **Texts** in en, de, fa and ckb in the copy deck (`games.snareSnake`): name, tagline, goal, progress
  line, win title, the lose reason "tangled", three counter labels, four how-to-play steps, four tutorial
  sentences and three pack names; the second lose reason "out-of-moves" is written in the catalogs by hand
  (the deck holds one lose reason per game). The fa and ckb texts are drafts for the owner's review (O6).
- **Sample statistics** for the S10 game card: 214 critters caught, 96 loops closed, longest snake 23.

## Scaffold (E21-T03)

`npm run new-game -- --app snare-snake --name "Snare Snake" --hints none --continue once --lose-reason tangled`:
bundle id `io.applander.snaresnake`, Premium `io.applander.snaresnake.premium` (O4), daily on, endless off,
hints none, continue once, violence NONE. The scaffold's plan (2026-10-19) lists 19 new files and suggests
the daily salt `0x36d5`; E21-T07 fixes it forever in `src/levels/snare-snake-levels.ts`.
