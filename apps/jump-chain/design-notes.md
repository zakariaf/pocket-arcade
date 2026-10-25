# Jump Chain: design notes

Game 6 of the catalogue (`jump-chain`), written 2026-10-19 for epic E23 before any code. Every answer is
a proposal with its reason; the owner approves them in one message (`owner-request.md`), and until then
the proposals apply. A later answer that changes a decision becomes a test-first change in the layer it
touches. The spec lines are quoted from `spec-lookup.mjs jump-chain 13 12 10 11 8.1 8.2 8.3 8.5 8.10 D2 D9`.

> Spec 13, catalogue entry 6: "Solo checkers: one piece against advancing enemy ranks; only multi-jump
> chains clear them. Risk: the board-game roguelike space is crowded, and a close jam precedent exists
> (Tiny Checkers)."

## What it is

Solo checkers: one piece against advancing enemy ranks, and only multi-jump chains clear them. Drag your
piece through a chain of jumps; every jumped enemy is removed; then the enemy ranks advance one step.

**The rules in full (v1, every number a tuning default until the owner's play-test):**

- **The board** is a checkerboard of 7 columns and 10 rows (row 0 at the top, row 9 at the bottom, "your
  side"). Like checkers, everything stands on the dark squares only (column + row even). 7 columns keep
  the board symmetric and give cells of about 53 pt on a 402 pt phone (S5, 8.11: at least 44 pt).
- **Your piece** (a crowned checker) starts in the middle of row 7, two rows below the front rank.
- **The enemy ranks** are rows of enemy checkers on the odd rows, at most three per rank (columns 1, 3
  and 5). They never stand on an edge column, because an enemy on the edge could never be jumped (the
  square behind it would be off the board); the first prototype had enemies there and no bot could win.
  A level has 3 to 6 ranks, two rows apart; the ranks that do not fit yet wait above the board and come
  in as the formation advances.
- **A move** is one of:
  - **a jump chain**: jump diagonally over an enemy next to you onto the empty dark square right behind
    it, which captures that enemy; from the landing square you may keep jumping in any diagonal, as a
    checkers king does, and you may stop after any jump. Because the ranks stand two rows apart, the
    square behind a rank is always free, so a chain zigzags along a rank or through rank after rank: "only
    multi-jump chains clear them". (The prototype first allowed only chains that keep going up or down;
    such a chain takes one enemy per rank, and no bot could keep up with the march.)
  - **a step** one square diagonally (any of the four directions) onto an empty dark square, allowed only
    when no jump exists (the checkers rule "a capture must be taken"; you choose which and how long).
- **The march**: every few moves (`marchEvery` of the tuning row, set by the sims of E23-T06) the
  enemy ranks advance one row: every enemy moves two squares straight down, front rank first, so it stays
  on the dark squares. An enemy whose square is blocked by your piece, or by an enemy that could not move,
  waits. When your move leaves no enemy on the board while ranks still wait above, the next rank marches
  in at once.
- **Losing:** an enemy reaches row 9, your side: `jump-chain.lose.overrun`.
- **Winning (levels and daily):** every enemy of the level is captured.
- **Score:** the n-th jump of a chain is worth 10 x n points (a 1-chain 10, a 2-chain 30, a 3-chain 60);
  clearing the last enemy of a rank adds 50. Long chains are the skill the score rewards.

## Classification

**Turn-based** (game-rules-engine, "Classifying a game"): `applyMove` applies your move and the march
that follows it, then the board animates the events. No clock, no real-time loop. The rules draw from the
seeded sfc32 RNG after `create` (the endless mode spawns new ranks), so the RNG state is part of the
state. If the owner wanted a real-time march, the game would move to the real-time class (a much larger
change); nothing suggests it.

## Input

A **drag** along the jump path: put a finger on your piece and drag it to the square where the chain
should end (`engine.panMode` `'drag'`, `selectRegions` `[]`). While dragging the board previews the chain
and the enemies it captures. The same move works without a gesture: **a tap on the landing square**
plays the chain that ends there, and a tap on a free neighbouring square plays a step (the one-handed and
VoiceOver way, and the way the E2E flows play). When several chains end on the same square, the one that
captures the most is played, and among equally long ones the first listed (up-left before up-right
before down-left before down-right). Like Line Siege's drag, the
dragged piece is drawn a little above the finger (`dragLiftPt`) so the finger never hides it. Every touch
target is a 53 pt cell, at least 44 pt (S5, 8.11).
If the owner prefers taps on each landing square in turn, the tap way changes in `intentToMove` only.

## Modes

**Levels + Endless + Daily** (spec 8.2: "LEVELS Always on", "DAILY ... On by default", "ENDLESS ... For
games with no natural end ... Optional per game"). Endless is `create(seed, 100)`: new ranks keep coming,
the run is never won and ends when the ranks reach your side; its best shows on Home ("Endless – Best
4,210"). If the owner turns Endless off, `modes.endless` and the levels spec's endless kind go together.

## Packs

**3 packs of 30 levels** (D9: "3 packs x 30 levels, plus Daily; Endless where it fits"), unlocked by
stars (S8). Pack names: "Opening moves", "Middle game", "Endgame" (the stages of a checkers game), in
four languages in the copy deck. Level difficulty rises from 0 to 99 across the 90 levels.

## Stars

**Score thresholds per level** (spec 8.1: "Score games: 3 / 2 / 1 stars at score thresholds"). Every level
is generated from its seed and proven winnable by the witness (the greedy bot), and its thresholds come
from the witness's score: 1 star for winning, 2 and 3 stars at margins around the witness score that the
level plan sets. S7 shows the score line "Score 1,840 – best 1,840" (L3, `s7-result-win--score`). If the
owner preferred moves against par, the star rule would need a solver; a score keeps long chains rewarded.

## Undo

**None**: every move is final (spec 8.5: "Undo: if the game supports it ... the game can limit it"). The
march follows the move at once, and undoing a chain after seeing the march would make scores dishonest.

## Hints

**`none`**: no hint key on S5 and no hint entry on S6 (8.5: "A game without hints ... shows no hint key on
the Game screen and no hint entry in the Pause menu", L8). `hints.freePerDay` is 0 and the game fact
`hasHints` is false. The drag preview already shows every chain before you let go.

## Continue

**`once`**: after a loss the enemy ranks step back one row (two squares straight up, the way they came, so
they stay on the dark squares; an enemy whose square is taken moves further up to the next free one) and
the march clock restarts (8.10: "Games may allow one continue per level or run: for example the monsters
are pushed back one row"). It costs a rewarded ad, or is free with Premium; offline and not Premium there
is none. While the ad loads the offer shows busy, and a hidden offer means none, so the result shows at
once (L11). A second continue in the same run is refused.

## Ways of losing

One: `jump-chain.lose.overrun` ("The enemy ranks reached your side"). Your piece is never captured: the
enemies only march. S7 shows the reason in one short, friendly sentence.

## Counters (2 to 4)

| Counter         | Id                | Aggregate | Counted from                                  |
| --------------- | ----------------- | --------- | --------------------------------------------- |
| Pieces captured | `pieces-captured` | sum       | each `enemies-captured` event                 |
| Ranks cleared   | `ranks-cleared`   | sum       | each `rank-cleared` event                     |
| Longest chain   | `longest-chain`   | max       | the jumps of one chain (S10 shows it as "×5") |

S10's game card lists them in this order, with the best-of counter last, like the other design games.

## Music

**None** (8.7, L1): only synthesised sound effects (step, jump, capture, rank cleared, march, win, lose),
so S6 and S11 drop the Music rows and parity uses the `--no-music` references.

## Age rating

Cartoon or fantasy violence: **`NONE`** (step G1): checkers pieces are captured by jumping, nothing is hit
or hurt on screen.

## Bands and the kill test (proposed; the sims in E23-T06 tune them)

Four tuning rows on the 0 to 100 scale (`rowFor` with four rows), plus the endless row at 100:

| Row     | Difficulty | Ranks                 | Fill per rank | March every | Front rank starts on |
| ------- | ---------- | --------------------- | ------------- | ----------- | -------------------- |
| 0       | 0-24       | 3                     | 85 %          | 5 moves     | row 5                |
| 1       | 25-49      | 4                     | 80 %          | 4 moves     | row 5                |
| 2       | 50-74      | 5                     | 75 %          | 4 moves     | row 5                |
| 3       | 75-99      | 6                     | 70 %          | 3 moves     | row 5                |
| endless | 100        | new ranks keep coming | 70 %          | 3 moves     | row 5                |

These are starting values: the sims of E23-T06 tune them one knob at a time. A scratch prototype of these
rules (100 seeds per row) already showed the kill test passing: the greedy bot captured within 3 moves in
every run and chained two or more jumps in 98 % of runs; with the ranks marching every 5 moves it won 75 %
of the easiest levels and the lookahead bot 97 %. Proposed bands: the greedy bot wins at least 90 % of the easiest row and less on each harder row (a
monotonic curve); random play wins clearly less than greedy, and the lookahead bot more. The kill test
(game-balance-and-bots rule 9): on the easiest level **the first capture comes within 1 to 3 moves** in at
least 90 % of greedy runs (the piece starts two moves from the front rank, which the march brings closer),
and **a chain of two or more jumps** (the twist) happens at least once per run. The bands stay
`"proposed"` until the owner's play-test (O6).

## Daily

The daily runs the level generator at difficulty 45 (8.3: "at a medium difficulty") with Jump Chain's own
salt `0x748e` (the scaffold's suggestion of E23-T03, fixed forever in `src/levels/jump-chain-levels.ts` in
E23-T07; never shared with another game).

## Teaching

A scripted first level: (1) step next to the front rank, (2) jump a two-enemy chain, (3) watch the ranks
advance and jump again. Four how-to-play pages, each with a small board picture: move, jump, chain, march.

## The design pass (Toybox)

Jump Chain joins the Toybox design as a design game:

- **Paint** (`reports/jump-chain/jump-chain-paint.json`, checked by `write-palette.mjs --dry-run`): light
  Peach wash `#FFCDB2`, Porcelain `#FFF9F4`, sunken `#FFE3D3`, accent Checker red `#FF5A5F`, pop Crown lilac
  `#A996FF`; dark Cocoa night `#2B1820`, Cocoa lid `#3F2632`, sunken `#351F29`, Moonlight `#FFF3F0`, Rose
  dusk `#E8BFC8`, chalk line `#FFE0E6`, shadow `#12070C`, Glow red `#FF7076`, Night lilac `#B9A8FF`.
- **Logo** on the 48 grid: a white crowned checker in mid-jump over an ink checker, with the lilac jump
  arc behind them (five layers: `pl`, `k`, `w`, `kl`, `p`).
- **Texts** in en, de, fa and ckb in the copy deck (`games.jumpChain`): name, tagline, goal, progress line,
  win title, lose reason, the three counter labels, four how-to-play steps, three tutorial steps and three
  pack names. The fa and ckb texts are drafts for the owner's own review (O6, step G7).
