# Poker Drop: design notes

Game 10 of the catalogue (`poker-drop`), epic E27. Every answer below is a proposal with its reason;
the owner approves them in one message (new-game-scaffold "Before code"), and until then the
proposed answer applies. An answer that changes later becomes a test-first change in the layer it
touches. The spec lines are quoted from `spec-lookup.mjs poker-drop 13 12 10 11 8.1 8.2 8.3 8.5 8.10
D2 D9` (2026-10-19), never from memory.

> Spec 13, poker-drop: "Catalogue number 10. Drop cards into a 5-column well; poker hands in any
> line burst and cascade. Risk: clear-rate tuning; whether card imagery triggers a "simulated
> gambling" age rating is unconfirmed."

## 1. What it is

Drop cards into a 5-column well; poker hands in any line burst and cascade. Tap a column to drop
the next card; any row, column or diagonal that makes a poker hand bursts; cards above fall and may
make new hands.

The base everyone knows is poker hands (Poker Squares, a 5 x 5 grid of poker lines); the twist is
gravity: the cards that make a hand burst, the cards above fall into the holes, and the fall can
make a new hand (a cascade). The player stops dropping "wherever it fits" and starts building
hands under the cards they want to fall.

The rules of version 1, in plain words:

- **The well** is 5 columns wide and 6 rows tall (30 cells). A dropped card falls to the lowest
  empty cell of its column, as in Connect Four.
- **The cards** come from a seeded, shuffled deck that the level draws in order; when it runs out a
  new deck is shuffled from the same seed stream. The player sees the card in hand and the next
  card. Easy levels use a short deck (9 to ace: more pairs and straights); harder levels add lower
  ranks down to the full 52 cards (2 to ace).
- **A line** is any 5 cells in a straight line inside the well: each row (6), each 5 cells of a
  column (2 per column, 10), and the 4 diagonals of 5 cells. A line counts only when all 5 cells
  hold a card.
- **A hand** is the poker value of a full line's 5 cards: two pair, three of a kind, straight,
  flush, full house, four of a kind, straight flush (a royal flush is the best straight flush; an
  ace also plays low in A-2-3-4-5). **Two pair or better bursts.** A single pair or a high card
  does not: that line stays as it is until something under it changes.
- **What bursts:** the cards that make the hand. Two pair bursts its 4 paired cards, three of a
  kind its 3, four of a kind its 4; a straight, flush, full house or straight flush bursts all 5.
  The other cards (kickers) stay. Every line that makes a hand after a landing bursts at the same
  time; a card in two bursting lines bursts once.
- **The cascade:** after a burst every card above a hole falls straight down. If the fall makes new
  hands, they burst too (cascade step 2, 3, ...), until a step makes no hand. The cascade is capped
  (`maxTicks`), so a move always ends.
- **Score:** each hand scores its points times its cascade step (step 1 x1, step 2 x2, ...):
  two pair 20, three of a kind 30, straight 40, flush 50, full house 70, four of a kind 100,
  straight flush 150. The points live in the tuning file (`poker-drop-tuning.ts`).
- **A level** asks for a number of hands (the goal, "Hands 3 / 8" in the top bar). Reaching it wins
  the level at once; the score decides the stars.

## 2. Classification

**Simulate-then-replay** (game-rules-engine `engine-contract.md`, "Classifying a game": "Toggle
Drop, Poker Drop cascades, Bank Shot"). The cascade of bursts and falling cards runs inside
`applyMove` with the game kit's fixed step (1/120 s): the dropped card falls, lines burst, the cards
above fall with the same gravity, and the result is an ordinary event list with timestamps
(`card-dropped`, `hand-burst`, `cards-fell`, each with `atMs`), stopped at `maxTicks`. Saving, undo,
bots and goldens stay turn-based: a move is one tap on a column.

If the owner prefers instant cascades (no fall), only the timeline changes; the rules stay.

## 3. Input

**A tap on the column to drop into** (`engine.panMode` `'none'`, `selectRegions` `[]`). A tap
anywhere in a column that has room drops the card in hand there; a tap on a full column or outside
the well does nothing (`intentToMove` returns `null`). Each column is a target of at least 44 pt
(board-gestures-and-input; S5 and 8.11: 44 x 44 pt). One finger, portrait, no drag.

If the owner wants a drag-to-aim drop instead, `panMode` becomes `'drag'` and `intentToMove`
reads `drag-end`; the rules do not change.

## 4. Modes

**Levels + Endless + Daily** (spec 8.2: "LEVELS Always on"; "DAILY ... On by default"; "ENDLESS For
games with no natural end ... Optional per game"). The daily uses the game's own salt (8.3: "The
level number comes from today's local date plus the game's own salt ... at a medium difficulty"),
fixed forever in E27-T08 from the scaffold's suggestion. Endless is `create(seed, 100)`: the
endless tuning row has goal 0, so it is never won; it ends when the well is full, and Home shows
its best ("Endless – Best 4,210").

Scaffold flags: `--hints none --continue once --lose-reason well-full --endless` (daily on).

## 5. Packs

**3 packs of 30 levels** (D9: "Default: 3 packs x 30 levels, plus Daily; Endless where it fits";
8.1), unlocked by stars as S8 says. Pack names (drafts, four languages in the copy deck): "First
deal", "Full house", "Royal flush". The difficulty rises from 0 at level 1 to 99 at level 90 on the
one 0..100 scale; the daily plays at difficulty 45.

## 6. Stars

**Score thresholds per level** (8.1: "Score games: 3 / 2 / 1 stars at score thresholds"): 1 star
for reaching the level's hand goal, 2 and 3 stars at score thresholds set per level from the
witness bot's score with the level plan's margins. The best result per level is kept. S7 shows the
score line "Score 1,840 – best 1,840" (L3, `s7-result-win--score`), so `winLine` is `"score"`.

Reason: the goal is a number of hands, so every finished level has made the same number of hands;
the score tells a level of pairs-into-two-pairs apart from one of flushes and cascades.

## 7. Undo

**None.** Every drop is final (8.5: "Undo: if the game supports it ... the game can limit it").
The next card is visible, so a careful player loses nothing, and the score stays honest. The S5
top bar shows no undo key.

## 8. Hints

**`none`.** No hint key on S5 and no hint entry on S6 (8.5: "A game without hints (for example Line
Siege) shows no hint key on the Game screen and no hint entry in the Pause menu (lead decision
L8)"). `hints.freePerDay` 0 and the game fact `hasHints` false. The witness bot proves levels
winnable, but its move is a greedy guess, not a solver's proven next move.

## 9. Continue

**`once`: the top row of the well is cleared** (8.10: "Games may allow one continue per level or
run"; "Cost: a rewarded ad, or free with Premium. Offline and not Premium: no continue"; "When no
continue can be offered, the result appears at once"). After a loss, the five cards of the top row
leave the well (every column gets room again) and the run goes on with the same cards in hand. One
continue per run; a second loss in the same run ends it. While the rewarded ad loads, the offer
shows busy; a hidden offer means none, so the result shows at once (L11). Undo never crosses it
(there is no undo).

## 10. Ways of losing

**One: `poker-drop.lose.well-full`, "The well is full"** (S7: a short, friendly reason). The run
is lost when no column has room for the card in hand. An endless run ends only this way.

## 11. Counters (2 to 4)

- **Hands made** (`hands-made`, sum): every hand that burst, cascades included.
- **Big hands** (`big-hands`, sum): hands of a straight or better.
- **Biggest cascade** (`biggest-cascade`, max): the longest chain of cascade steps in one drop. The
  S10 game card shows a reached max counter as a multiplier ("x3"), which reads as "a chain of 3".

**Changed from the epic's list:** the epic proposes "Best hand (`best-hand`, max)". The Shell shows
every reached max counter as a multiplier (`statsSnapshotOf`: "A reached best-of counter reads as a
multiplier (the design's x6)"), so a best hand stored as its rank 1-8 would read "x7" for four of
a kind, which means nothing to a player. "Big hands" keeps the idea (how often the player builds
the hands worth the most) as a plain count. If the owner wants "Best hand" back, the Shell needs a
named-value counter for every game (N5); that is a Shell change, proposed separately.

## 12. Music

**None.** The sound bank has a drop, a burst per hand kind, a cascade step, the win and the lose;
no music, so S6 and S11 drop the Music rows and parity uses the `--no-music` references (L1).
`hasMusic` false.

## 13. Age rating

- **Cartoon or fantasy violence: `NONE`** (step G1). Nothing is hit, hurt or destroyed; cards burst.
- **Simulated gambling: none.** The game uses playing cards and poker hand names only: nothing is
  wagered, there is no money, no chips, no betting, no casino and no chance-based payout; the score
  comes from the hands the player builds. The pack names and texts avoid casino words. The answer
  for "simulated gambling" is the owner's at G1 (the catalogue's open risk); the default is "none".

## 14. Bands (proposed; E27-T07 measures and sets them)

The tuning file has four rows on the 0..100 scale (rows picked with `rowFor`: 0-24, 25-49, 50-74,
75-99) and the endless row at 100. Each row sets the deck (lowest rank), the prepared opening (how
many bottom rows are dealt, how many are prepared two pairs), the hand goal and the points:

| Row         | Deck                | Opening                     | Goal          | Intent                                    |
| ----------- | ------------------- | --------------------------- | ------------- | ----------------------------------------- |
| 0 (easiest) | 9 to ace (24 cards) | 2 rows dealt, both prepared | about 6 hands | a warm-up a reasonable player always wins |
| 1           | 7 to ace (32 cards) | 2 rows, 1 prepared          | about 8       | random play starts to lose                |
| 2           | 5 to ace (40 cards) | 3 rows, 1 prepared          | about 8       | needs planning                            |
| 3 (hardest) | 2 to ace (52 cards) | 3 rows, 1 prepared          | about 8       | greedy play loses often                   |
| endless     | 2 to ace            | 2 rows, none prepared       | 0 (never won) | lasts until the well fills                |

Proposed bands: the greedy bot wins at least 90 % of the easiest row and 25 % to 60 % of the
hardest, and its win rate falls by at least 0.05 per row; the random bot wins clearly less than the
greedy bot from row 1 on (a skill gap of at least 0.15 at the second row), and the lookahead bot at
least as much as the greedy bot; a level lasts 15 to 60 drops; an endless run lasts 30 to 200 drops
and is never won.

**The kill test** (game-balance-and-bots rule 9; fun-and-kill-test.md): on the easiest level the
first hand bursts within 1 to 3 drops in at least 90 % of greedy runs, and a cascade makes a second
hand at least once per run. The opening is built for it from the seed: the gap column is empty and
the bottom row holds two pairs, so the first drop into the gap bursts them; with a second prepared
two-pair row above it, the fall makes the second hand at once (payoff event `hand-burst`; twist
event: a `hand-burst` at cascade step 2 or more). A toy of these rules (seeded, 100 runs per cell,
in the session scratchpad, not shipped) measured: easiest row, greedy first burst within 3 drops in
100 % of runs, 1.1 cascades per run; hardest row, random 16 %, greedy 69 %, lookahead 98 % wins;
endless, greedy median 68 drops. E27-T07 replaces these numbers with the real sims.

If the owner changes a band, only the tuning file and `balance-bands.json` change (and the packs are
regenerated with a `Gate-Change:` trailer).

## 15. The Toybox design pass

Poker Drop is drawn into the Toybox design (`design/toybox.html`, `design/toybox/tokens.json`,
`design/shared/copy-deck.json`) the way Line Siege, Flock Tilt and Scrap Shove are:

- **Palette** "card room velvet": light ground Velvet wash `#CDBDF4` (a lilac felt), surface Card
  stock `#FCFAFF`, sunken `#EAE3FB`, accent Ruby `#FF5C7A` (hearts red, "go"), pop Felt `#4CD08A`
  (card-table green); dark ground Velvet night `#1E1640`, surface Card box `#2E2460`, sunken
  `#261D50`, ink Moonlight `#F6F2FF`, inkSoft Lavender `#C3B8F0`, outline `#E9E2FF`, shadow
  `#090616`, accent Glow ruby `#FF7690`, pop Night felt `#5EE09B`. It passes the Toybox palette
  rules (`write-palette.mjs --dry-run`).
- **Logo** on the 48-unit grid: two fanned cards (the back one in pop, the front one white with an
  ink spade) under a short drop arrow.
- **Texts** in en, de, fa and ckb: name, tagline, goal, progress line, win title, the lose reason,
  the three counter labels, four how-to-play steps, four tutorial steps and three pack names. The
  fa and ckb texts are drafts for the owner's own review (O6, G7).
- **How-to-play picture**: a 5 x 6 well with a burst two-pair row and the cards above falling.

If the owner picks another paint or logo, only the design files and the generated palette and art
change (E27-T02 records it as a `referenceChanges` entry).

## 16. Ids and store facts

- App id `io.applander.pokerdrop` on iOS and Android, Premium `io.applander.pokerdrop.premium` at
  EUR 1.99, Family Sharing off (O2, O3, O4).
- In-game name "Poker Drop" in all four languages; App Store name "Poker Drop: Puzzle" (G1, the
  owner's App Store Connect record, Apple ID 6824608929).
- Daily salt: `0x4ef1`, the scaffold's suggestion (E27-T03, `scaffold-game.mjs` plan of 2026-10-19), fixed forever in
  `src/levels/poker-drop-levels.ts` by E27-T08; never shared with another game.
