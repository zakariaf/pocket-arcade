# Swap Guard: design notes (E25-T01)

Game 8 of the catalogue, game id `swap-guard`, app ids `io.applander.swapguard` and
`io.applander.swapguard.premium` (owner decision O4). These notes answer every question of
new-game-scaffold's "Before code" checklist with a proposed answer, its reason, and what changes if
the owner answers differently. Spec lines are quoted from `spec-lookup.mjs`, never from memory.

> **swap-guard · Swap Guard** (spec 13): "Catalogue number 8. Telegraphed-attack tactics where the
> only move is swapping places, so enemies hit each other. Risk: many interacting systems (enemy
> types, resolution order) for a first version; overlaps Scrap Shove."

The risks shape the answers below: three enemy kinds at most, one resolution order (all strikes land
at once), and no enemy ever moves by itself, so it never chases the player as Scrap Shove's robots do.

## 1. What it is

**Proposed.** A little guard stands on a square board among enemies. Every enemy shows the squares it
will strike (shaded squares with an arrow). The only move is a swap: tap a square next to the guard
(also diagonally) and the guard swaps places with whatever stands there, an enemy or an empty tile.
Then every strike lands on the squares that were shown. Anyone standing on a struck square is hit:
an enemy is knocked out (even by its own strike), the guard loses the level. Knock out every enemy.

The rules in full (v1, every number a default until the owner's play-test):

- **Board.** A square grid, 5 x 5 or 6 x 6 by difficulty row. It is a physical space and never
  mirrors in fa and ckb (spec 7.5).
- **Enemy kinds (three, v1 cap).** _Spear_: strikes the one square in front of it. _Archer_: shoots
  along its facing; the arrow strikes every square up to and including the first piece in its way.
  _Brute_: slams the four squares beside it (no facing). Facings never turn; an enemy only moves when
  the guard swaps with it, and it keeps its facing.
- **The swap.** The guard swaps with one of the up to eight squares around it. Swapping with an enemy
  puts that enemy on the guard's old square; swapping with an empty tile is a step.
- **The strikes (one resolution order).** After the swap, every strike lands at once on the squares
  that were shown before the swap, listed by enemy in a fixed order. An enemy struck in the same
  volley still strikes. Knocked-out enemies leave the board. Then the strikes are shown again from
  where everyone stands now (an archer's arrow now flies past a knocked-out blocker).
- **Swaps.** Each level has a swap budget, drawn on the board as a row of pips: the swaps of a sure
  line that `create` plans for the start, plus a few spare swaps that shrink with difficulty (3, 1, 0
  and 0 by row). A start is kept only when that line exists, so no level and no daily is impossible
  (spec 8.1); the exact par still comes from the BFS solver, often below the budget.
- **Score.** 100 points per enemy knocked out, 50 more for each extra enemy in the same volley (the
  double hit), and on a win 10 points per swap left over.
- **The opening.** Every level starts with the guard in a strike, next to an enemy whose own strike
  already covers the attacker: swapping it into the guard's square makes the two hit each other at
  once (the first payoff and the twist on the first swap).

**Reason.** The base everyone knows is the telegraphed-attack tactics game; the twist is that the
player never attacks, so every knock-out comes from the enemies' own strikes. Static facings keep
every strike readable before the swap, which is what makes a turn-based puzzle verifiable (the BFS
solver, par and hints).

**If the owner answers differently.** A rule change is a test-first change in the rules layer, then
a sim rerun and regenerated packs (`Gate-Change:`).

## 2. Classification

**Proposed.** Turn-based: apply the move, then animate its events (game-rules-engine's table already
lists Swap Guard as turn-based). No randomness after `create`: the whole future of a level is fixed by
its seed and difficulty, so the levels are proven by an exact BFS search with par.

**Reason.** Spec 10 RULES: "Apply a move: returns the new state plus a list of events".

**If different.** Nothing else can apply: there is no continuous phase.

## 3. Input

**Proposed.** A tap on the square to swap with: `engine.panMode` `'none'`, `selectRegions` `[]`.
`intentToMove` turns a tap on one of the squares around the guard into that swap and every other tap
into `null`. Cells are at least 44 pt on a 402 x 874 pt phone (6 x 6 in a 374 pt wide board area:
about 58 pt).

**Reason.** One input, one finger, portrait (spec 8.11); taps are the safest touch control (spec 13
research lessons).

**If different.** A drag from the guard to the square would add `'drag'` and a drag-end intent;
nothing else changes.

## 4. Modes

**Proposed.** Levels + Daily (spec 8.2: "LEVELS Always on", "DAILY ... On by default"); no Endless
(every level has a natural end), so Home shows no Endless card. `modes: { levels, daily }` in the
copy deck; `--no-endless` is the scaffold default.

**If different.** An endless mode would need an endless row (difficulty 100) that never wins, which
does not fit a puzzle with par.

## 5. Packs

**Proposed.** 3 packs of 30 levels (spec 8.1, D9: "3 packs x 30 levels, plus Daily"), unlocked by
stars (S8, the Shell's default thresholds 0, 45 and 90). Pack names: "Gatehouse", "Courtyard",
"Throne room" (four languages in the copy deck).

## 6. Stars

**Proposed.** The puzzle rule of spec 8.1: "3 stars at or under par, 2 stars at par +2, 1 star for
finishing". Par is the fewest swaps, from the BFS solver. S7 shows "7 moves – par 7" (base frame
`s7-result-win`; game fact `winLine: "moves"`).

## 7. Undo

**Proposed.** Unlimited (spec 8.5: "unlimited in puzzle games"), never across a continue (the Shell
forbids it).

## 8. Hints

**Proposed.** `solver`: the solver's next good swap, highlighted on the board (`highlight.hinted`)
once it is paid for: 1 free a day, then a rewarded ad, unlimited with Premium (spec 8.5, D2: "hints
and continues become free"). `hints.freePerDay` 1 and the game fact `hasHints` true, so S5 shows the
hint key (lead decision L8).

## 9. Continue

**Proposed.** `once`: the last swap is undone, so the knocked-out enemies of that volley stand again
and the swap is given back (spec 8.10: "one continue per level or run: for example ... the last move
is undone"). Cost: a rewarded ad, or free with Premium; offline and not Premium, none. While the ad
loads the offer shows busy, and a hidden offer means none, so the result shows at once (L11). A second
continue in the same run is refused.

## 10. Ways of losing

**Proposed.** Two, one catalog key each:

- `swap-guard.lose.hit`: "A strike hit you" (the copy deck's lose reason, S7's lose frame).
- `swap-guard.lose.out-of-swaps`: "You ran out of swaps" (written by hand in the four catalogs; not in
  the design deck).

**Reason.** The epic proposed only `hit`. Without a budget a careful player (and every bot) can walk
around a calm board forever: the balance sims must end every run before the move cap
(game-balance-and-bots rule 3), and a level whose enemies can no longer all be knocked out would never
end. The budget is the template game's own pattern (Tap Flip's out-of-moves).

**If different.** Dropping the budget needs another way to end a stuck run; the owner's answer
becomes a rules change, test first.

## 11. Counters (2 to 4)

**Proposed.** Three sums, counted from each kept swap's events (spec 10 STATISTICS):

| Counter id         | Label (en)       | Aggregate | Counts                                           |
| ------------------ | ---------------- | --------- | ------------------------------------------------ |
| `enemies-defeated` | Enemies defeated | sum       | every enemy knocked out                          |
| `swaps-made`       | Swaps made       | sum       | every swap                                       |
| `double-hits`      | Double hits      | sum       | every volley that knocks out two or more enemies |

## 12. Music

**Proposed.** None (spec 8.7: a synthesised sound bank; no music), so S6 and S11 drop the Music rows
and parity uses the `--no-music` references (L1): game fact `hasMusic: false`.

## 13. Age rating

**Proposed.** Cartoon or fantasy violence `INFREQUENT_OR_MILD` (step G1): toy enemies knock each other
over with no blood, no injury shown.

## 14. Bands and the kill test

**Proposed difficulty curve** (four tuning rows on the 0..100 scale, sampled at 0, 25, 50, 75):

| Row | Difficulty | Board | Enemies | Kinds                | Swaps |
| --- | ---------- | ----- | ------- | -------------------- | ----- |
| 0   | 0-24       | 5 x 5 | 3       | spear, archer        | 12    |
| 1   | 25-49      | 5 x 5 | 4       | spear, archer        | 14    |
| 2   | 50-74      | 6 x 6 | 4       | spear, archer, brute | 16    |
| 3   | 75-99      | 6 x 6 | 5       | spear, archer, brute | 18    |

**Tuned (E25-T06, the rows in `swap-guard-tuning.ts`).** The sims showed that some drawn starts
could not be won at all (a lone brute, or a spear or archer whose back is to the edge), and that
those impossible boards were most of the greedy player's losses. `create` now keeps only starts its
planned line wins, and the budget is that line plus the spare swaps:

| Row | Difficulty | Board | Enemies | Kinds                | Most swaps | Spare swaps |
| --- | ---------- | ----- | ------- | -------------------- | ---------- | ----------- |
| 0   | 0-24       | 5 x 5 | 3       | spear                | 12         | 3           |
| 1   | 25-49      | 5 x 5 | 4       | spear, archer        | 12         | 1           |
| 2   | 50-74      | 6 x 6 | 5       | spear, archer, brute | 15         | 0           |
| 3   | 75-99      | 6 x 6 | 6       | spear, archer, brute | 18         | 0           |

Brutes only ever open a level (as the partner of the double hit): no swap sends a lone brute into
its own strike. The greedy player wins 0.98 / 0.89 / 0.66 / 0.51 of the four rows, random play none
(`reports/sim/swap-guard.json`).

A rules prototype (100 seeds per row, the scratch run behind these notes) measured: every row-0
board solvable with par 4 to 8; the greedy bot winning about 0.64 / 0.52 / 0.38 / 0.32 of the four
rows and the random bot none; the first payoff on the first swap in every greedy run; one double hit
per greedy run. The sims of E25-T06 measure the real rules and set the bands from their own numbers;
they stay `"status": "proposed"` until the owner's play-test (O6).

**Kill test.** First payoff: on the easiest level an enemy is knocked out by another enemy's strike
within 1 to 3 swaps (the prepared opening offers it on swap 1). Twist: one swap makes two enemies hit
each other (a double hit) at least once per run.

**If different.** The owner's play-test moves the bands; a rules change reruns the sims.

## 15. Daily

**Proposed.** Difficulty 45 (row 1, spec 8.3: "at a medium difficulty") with the game's own salt
`0x8790`, the scaffold's suggestion (E25-T03), fixed forever in `src/levels/swap-guard-levels.ts` at
E25-T07.

## 16. Teaching

**Proposed.** A scripted first level of four steps, one sentence and one expected swap each (S13):

1. "A strike is coming for you. Tap the enemy next to you to swap!" (the double hit)
2. "They hit each other! Now step behind the last enemy." (a step)
3. "Swap with it. Now its strike points at you." (the swap)
4. "Swap back: it walks into its own strike!" (the win)

How to play: four pages, each drawn by the board code: the shaded squares, the swap, the volley, and
"swap enemies into strikes, never end on one yourself".

## 17. The Toybox design pass

**Proposed.** Swap Guard is drawn into the Toybox design (`design/toybox.html`, its tokens and the copy
deck), next to Line Siege, Flock Tilt and Scrap Shove:

- **Paint** (`reports/swap-guard/swap-guard-paint.json`, passes write-palette's rules): light _Castle
  lilac_ `#CCC0F4` ground, _Parchment_ `#FBF9FF` surface, `#EAE4FC` sunken, _Shield blue_ `#5C9DFF`
  accent, _Torch orange_ `#FFA94D` pop; dark _Castle night_ `#2A1838`, _Battlement_ `#3D2552`,
  `#331E45` sunken, _Moonlight_ `#FBF2FF` ink, _Dusk lilac_ `#D7BCEB` muted, `#F2E2FF` outline,
  `#10061A` shadow, _Glow shield_ `#7FB4FF`, _Torch flame_ `#FFB463`.
- **Logo** (48-unit grid): a white shield split down the middle with a pop half and two ink swap
  arrows across it.
- **Texts** in en, de, fa and ckb: name (Latin everywhere), tagline, goal, progress line, win title,
  the lose reason, three counter labels, four how-to-play steps, four tutorial steps and three pack
  names. The fa and ckb texts are drafts for the owner's own review (O6, G7).
- **Sample statistics** for the S10 game card: 1,146 enemies defeated, 2,318 swaps made, 87 double
  hits; progress "Enemies 2 / 5" (top bar) and "Enemies 5 / 5" (win card).
