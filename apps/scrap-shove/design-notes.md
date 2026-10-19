# Scrap Shove: design notes

Game 3 of the catalogue (`scrap-shove`), epic E20. These notes answer every question of
new-game-scaffold's "Before code" checklist with a proposed answer, its reason, and what changes if
the owner answers differently. Spec lines are quoted from `spec-lookup.mjs scrap-shove 13 12 10 11
8.1 8.2 8.3 8.5 8.10 D2 D9`, never from memory.

Spec 13, `scrap-shove`: "Catalogue number 3. The twist needs strengthening first." "Pitch: robots
chase the player one step at a time and wreck themselves when they crash; shove the wreckage into
their path." "Controls: tap a square next to the player (tap the player to wait)." "v1 content: one
grid size, scrap, three robot kinds (normal, fast, heavy), floors that get denser." "Risks: the twist
barely shows up (over 300 simulated games a one-move-lookahead bot got about 0.25 chances per game to
crush a robot with scrap; the base is the 1976 game Chase); short runs; floor 1 can corner the player
quickly."

## 1. What it is

Robots chase the player one step at a time and wreck themselves when they crash; shove the wreckage
into their path. Step or shove, then every robot steps toward the player; crashes turn robots into
scrap; clearing a floor brings a new one with more robots. The twist: scrap heaps are pushed like
crates to block a robot or crush one behind the heap.

In Pocket Arcade terms a floor is one level: a level is won when every robot on it is scrap, and the
next level is the next, denser floor (spec 8.1, S8).

The rules, as proposed:

- **Board:** one grid size, 8 x 8 squares (spec 13: "one grid size"). Eight columns keep every square
  at least 44 pt wide on a phone (S5, 8.11: 374 pt / 8 = 46.75 pt); the toy's 9 x 9 would give 41.5 pt.
- **Pieces:** the player, scrap heaps, and three robot kinds:
  - **normal:** one step toward the player each turn (one king step: across, along or diagonal);
  - **fast:** two steps each turn (it steps again after every robot has stepped once);
  - **heavy:** one step each turn; scrap does not wreck it, it shoves the heap ahead of it; a heap
    it cannot shove (you, the wall or another heap behind it) it smashes to pieces and stays put; a
    robot that runs into it breaks down where it stood. Only a heap shoved onto it scraps it. This
    is the design fix (section 15).
- **Your turn:** tap one of the up to eight squares next to you to step there, or tap yourself to
  wait. Stepping onto a heap shoves it one square further the same way; a heap cannot be shoved off
  the board or into another heap. A heap shoved onto a robot crushes it (any kind).
- **The robots' turn:** every robot steps toward you, the nearest first (ties by its number), so a
  robot never runs into one that was about to move away. A robot that steps onto a heap is wrecked
  (the heap stays); two robots on one square crash and leave one heap; a robot that runs into a heavy
  robot breaks down on its own square (a new heap there). Then the fast robots step once more by the
  same rules.
- **Won:** every robot of the floor is scrap. **Lost:** a robot reaches your square. Every floor is
  proven winnable before it is shown (section 16).
- **Arrows:** each robot shows its next step as a faint arrow, so every outcome is visible before the
  tap (the toy's arrows).

## 2. Classification

**Turn-based: apply the move, then animate its events.** The whole future of a floor is fixed by
`create(seed, difficulty)` and the player's moves (robots are deterministic; nothing is drawn after
`create`), so the state needs no RNG and an exact BFS solver proves every floor and gives par.

If the owner answers differently: nothing else fits this game; a real-time version would need the
realtime-game-loop skill and a new design pass.

## 3. Input

A tap on a square next to the player steps there (or shoves the scrap on it), and a tap on the player
waits. `engine.panMode` is `'none'` (taps only), `selectRegions` is `[]`. A tap anywhere else, or on a
neighbour the rules refuse (a robot, a heap that cannot move, off the board), does nothing.

Reason: spec 13, "Controls: tap a square next to the player (tap the player to wait). The most
phone-friendly input of the three." One finger, one tap per move, every target at least 44 pt.

If the owner answers differently (for example "swipe to step"): `panMode` becomes `'swipe'` with eight
directions and `intentToMove` changes; the rules do not.

## 4. Modes

**Levels + Daily** (spec 8.2: "LEVELS Always on"; "DAILY One generated level per day (8.3). On by
default"). No Endless: "ENDLESS For games with no natural end"; a floor ends when every robot is
scrap, so Home (S4) shows no Endless card. The scaffold runs without `--endless`.

If the owner wants Endless: a run of floors at difficulty 100 (`ENDLESS_DIFFICULTY`), scored by robots
scrapped; it adds an endless tuning row, an endless sim block and the S4 Endless card.

## 5. Packs

**3 packs of 30 levels** (spec D9: "Default: 3 packs x 30 levels, plus Daily"), unlocked by stars
(S8), pack names from the copy deck: "Junkyard", "Factory floor", "Robot city", in en, de, fa and ckb.
Level difficulty rises from 0 at level 1 to 99 at level 90 on the 0..99 scale.

## 6. Stars

The puzzle rule of spec 8.1: "Puzzle games: 3 stars at or under par, 2 stars at par +2, 1 star for
finishing." Par is the fewest moves (waits count) that clear the floor, found by the BFS solver. S7
shows "7 moves – par 7" (the base `s7-result-win` reference); the parity facts say `winLine: "moves"`.

If the owner prefers score stars: a score rule (robots per move) and `winLine: "score"`; par stays as
the proof.

## 7. Undo

**Unlimited** (spec 8.5: "Undo steps back one move (unlimited in puzzle games; the game can limit
it)"), never across a continue.

## 8. Hints

**`solver`:** the solver's next good move, highlighted on the board; 1 free a day, then a rewarded ad,
unlimited with Premium (spec 8.5: "The game's solver suggests the next good move, and the Shell
highlights it. Hint budget: 1 free hint per day, then a rewarded ad per hint, or unlimited with
Premium (decision D2)"; D2: "removes all ads, and hints and continues become free"). So
`hints.freePerDay` is 1, `hasHints` is true, and S5 shows the hint key. From a state on the solver's
line the hint is the line's next move; off the line it is the first move of a fresh solve; a won or
lost state has none.

If the owner says no hints: `--hints none`, `hasHints` false, S5 hides the hint key (L8).

## 9. Continue

**`once`: the step that let the robot reach the player is undone.** The lost state keeps the floor as
it was before that move; the continue puts it back, so the player chooses again (spec 8.10: "Games may
allow one continue per level or run: for example ... the last move is undone"). It costs a rewarded
ad, or is free with Premium; offline and not Premium there is none ("Offline and not Premium: no
continue"). While the ad loads the offer shows busy, and a hidden offer means none, so the result
shows at once (L11: "When no continue can be offered, the result appears at once (S7)"). A second
loss in the same level cannot be continued; undo never crosses the continue.

If the owner says no continue: `--continue none`; nothing else changes.

## 10. Ways of losing

One: `scrap-shove.lose.caught`, "A robot caught you" (S7: a short, friendly reason; copy deck).

## 11. Counters (2 to 4)

| Counter         | Key               | Kind | Counted from                                     |
| --------------- | ----------------- | ---- | ------------------------------------------------ |
| Robots scrapped | `robots-scrapped` | sum  | every robot wrecked, crashed or crushed in a run |
| Scrap shoved    | `scrap-shoved`    | sum  | every heap the player shoved                     |
| Biggest crash   | `biggest-crash`   | max  | the most robots scrapped by one move             |

Labels from the copy deck: `scrap-shove.stats.robots-scrapped`, `.scrap-shoved`, `.biggest-crash`.

## 12. Music

**None** (spec 8.7; lead decision L1), so the Pause menu (S6) and Settings (S11) drop the Music rows
and parity uses the `--no-music` references (`s6-pause--no-music`, `s11-settings--no-music`,
`s14-reset-all-progress--no-music`). Sounds: step, shove, robot step, crash, crush, win, lose.

## 13. Age rating

**Cartoon or fantasy violence: `INFREQUENT_OR_MILD`** (step G1): robots crash into each other and are
crushed by scrap; nothing living is hurt. The scaffold runs with `--violence-rating
INFREQUENT_OR_MILD`.

If the owner answers `NONE`: one field in `game.config.ts`.

## 14. Bands and the kill test

The proposed difficulty curve, on the 0..100 scale with four tuning rows sampled at 0, 25, 50 and 75
(the bots' grid):

| Row    | Normal | Fast | Heavy | Heaps |
| ------ | ------ | ---- | ----- | ----- |
| 0-24   | 4      | 0    | 1     | 3     |
| 25-49  | 5      | 1    | 1     | 3     |
| 50-74  | 6      | 1    | 2     | 4     |
| 75-100 | 7      | 2    | 3     | 4     |

The hardest row first had 2 heavy robots; with them the greedy win rate fell only 0.09 from the row
before (0.32 to 0.23), so E20-T06 gave it a third (0.10). A third fast robot instead made it easier
(0.34: fast robots crash sooner).

Bands (set from the sim runs in E20-T06, `status: proposed` until the owner's play-test): the
greedy bot wins most of the easiest floors (0.66) and few of the hardest (0.10); random play wins
none ("naive bots should lose"); random < greedy < lookahead by a clear step (0.00, 0.45, 0.77 on
the second row); the greedy win rate falls with each row (0.66, 0.45, 0.32, 0.10).

The kill test (game-balance-and-bots rule 9), on the easiest floor:

- **First payoff:** a robot crash within 1 to 3 moves in at least 90 % of greedy runs. Every floor
  opens with a pair of robots that crash into each other on the first robots' turn, three or four
  squares away (the toy: "robots crash within 2-3 taps"; spec 13 risk: "floor 1 can corner the
  player quickly", so no robot starts next to the player: every robot starts at least 3 squares
  away).
- **Twist:** a shoved heap blocks or crushes a robot at least once per run (`twistPerRun` >= 1 for
  greedy). Twist events: a robot crushed by a heap the player shoved, and a robot wrecked on a heap
  the player shoved earlier.

## 15. The design fix: strengthening the twist

Spec 13: "The twist needs strengthening first." Three options were proposed and measured with bots
before any product code, in a throwaway prototype of the rules above (8 x 8, the easiest floor: 4
normal robots and 3 heaps, plus the option; 100 seeds per cell; greedy = one-move lookahead with a
position value, lookahead = three plies). The prototype reproduces the toy's finding: on the toy's
rules the greedy bot gets 0.27 twists per run (the toy: about 0.25).

| Option                                                                      | Greedy twists per run | Greedy wins | First payoff within 3 moves | Kept                   |
| --------------------------------------------------------------------------- | --------------------- | ----------- | --------------------------- | ---------------------- |
| The toy's rules, no fix                                                     | 0.27                  | 38 %        | 77 %                        | no                     |
| An opening crash pair only                                                  | 0.31                  | 60 %        | 100 %                       | yes (the first payoff) |
| A: heaps generated in the robots' paths (with the crash pair)               | 0.19                  | 75 %        | 100 %                       | yes, as part of A+B    |
| B: one heavy robot that only dies by a crushing shove (with the crash pair) | 0.90                  | 49 %        | 100 %                       | yes                    |
| B plus one heap in the heavy robot's lane                                   | 1.06                  | 63 %        | 100 %                       | yes                    |
| A + B                                                                       | 1.12                  | 74 %        | 100 %                       | **yes: the proposal**  |
| C: a scrap bonus in the score (a player who values every crush)             | 0.47                  | 64 %        | 100 %                       | no                     |

Random play wins 1 % of A+B floors and the three-ply lookahead 96 % (1.31 twists per run); 97 % of the
easiest A+B floors are solvable, with a median par of 4 moves (the level plan keeps only proven
floors).

What is kept, and why:

- **B, heavy robots:** the only option that moves the twist number to about one per run. A heavy
  robot cannot be wrecked by a crash or by walking into scrap, so every floor with a heavy robot can
  only be won by shoving a heap onto it: the twist becomes the way to win, not a rare extra. It even
  sets itself up: a heavy robot pushes a heap toward you until the heap is next to you, and you
  shove it back before it smashes the heap on its next turn.
- **A, heaps in the robots' paths:** alone it does not lift the twist (0.19), but with B it puts one
  heap in each heavy robot's lane and the rest ahead of the normal robots, which lifts the twist from
  0.90 to 1.12 and the win rate from 49 % to 74 %.
- **The opening crash pair:** makes the first payoff come on move 1 in every run (77 % to 100 %).
- **C, a scrap bonus, is dropped:** levels are rated by moves against par (spec 8.1 puzzle stars), so
  a score bonus is never shown or counted; even a player who values every crush only reaches 0.47.

The real rules are measured again in E20-T06; if the kill test fails there after reasonable tuning,
the owner decides between a rule change and dropping the game (E20-T06's Owner line).

**Measured in E20-T06 (the real rules, 100 seeds per cell).** The first sim run found floors that
never end: once only heavy robots were left, each waiting behind scrap it could not shove, the
player could wait for ever (greedy runs hit the 400-move cap 2, 1, 3 and 10 times on the four rows).
So a heavy robot now smashes a heap it cannot shove and stays put: no cap hit since, and the twist
gets a clear one-turn window ("shove it back now"). On the easiest row the greedy player then wins
66 %, reaches the first crash within 3 moves in 100 % of runs and sees 1.10 twists per run.

If the owner rejects the heavy robot: the twist stays near 0.3 per run, the kill test fails, and the
epic closes as dropped.

## 16. Daily

The daily level is `create(dailySeed(date, salt), 45)` (spec 8.3: "The level number comes from today's
local date plus the game's own salt, run through the same generator as normal levels, at a medium
difficulty"), with the salt the scaffold suggested in E20-T03, `0xd628`, fixed forever in E20-T07
(`src/levels/scrap-shove-levels.ts`).

The daily is not screened by the level plan, and about one raw layout in eight at the middle
difficulties cannot be won (measured before E20-T07). So `create` itself lays out floors from the
seed's random stream until the breadth-first solver proves one winnable (at most 20 layouts, 60,000
solver nodes each; a solve takes a few milliseconds): every level, every daily and every floor the
bots play can be won (spec 8.1: "no level is impossible").

## 17. App identity

- Name: "Scrap Shove" in all four languages (G1; the in-game name is the game's plain name).
- Bundle id `io.applander.scrapshove`, Premium `io.applander.scrapshove.premium` at EUR 1.99, Family
  Sharing off (O2, O3, O4).
- The App Store record exists (Apple ID 6824607374) and the bundle id is registered (G2, done by the
  owner and the lead).
