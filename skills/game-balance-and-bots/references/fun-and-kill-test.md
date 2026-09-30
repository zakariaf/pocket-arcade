# Fun within seconds: the kill test

Bots cannot feel fun, but they can measure its preconditions: how soon the first win moment comes, whether the twist actually happens, and whether choices matter. This reference turns what the prototype toys of the idea research revealed into tests every game passes before anyone polishes it.

## Contents

- Why seconds matter
- The three bot-measurable preconditions
- The kill test
- What the toys revealed
- Designing the opening for an early payoff
- Payoff and twist events for the first games
- When a game fails: stop and ask

## Why seconds matter

- Phone sessions are short (the median mobile session is 5-6 minutes), and board, card and puzzle games keep players longest when the first minute is clear. Successful small games "grab attention in the first half second".
- The winning shape for this catalogue is "a base everyone knows, plus one twist that changes decisions". The base is familiar; the twist must show up early and often, or the game is the base game with new paint.
- AI-built games fail silently on balance and pacing: they look right and are unplayable. Checking state with bots beats guessing.

## The three bot-measurable preconditions

1. **An early payoff.** A reasonable player reaches the first win moment (a pop, a crash, a capture, a penned sheep) within 1-3 moves on the easiest level (1-3 seconds for a real-time game, whose curve counts seconds). Measured by `firstPayoffShare` (the `firstPayoff` rule).
2. **The twist happens.** The game's special mechanic fires at least once per level for a reasonable player (`twistPerRun`, the `twist` rule).
3. **Choices matter.** Random play mostly loses; a reasonable player wins most easy levels; a far-sighted player wins more (the bands and the `skillGap` rule). "A script could beat 2048, so naive bots should lose" is a design test.

## The kill test

Run it on the idea's first playable rules, before art, sound or screens:

1. Write `create`, `listMoves`, `applyMove`, `outcome` and the bot hooks with payoff and twist tags.
2. Run the sim at the easiest difficulty with `random`, `greedy` and `lookahead` (100 seeds each).
3. Pass when: greedy reaches the first payoff within 3 moves in at least 90 % of runs; greedy sees at least one twist per run; random wins clearly less than greedy.
4. If greedy fails, try the upper bound: can even `lookahead` (which sees the seeded future) reach a payoff early? If a search that sees every future move cannot find a payoff within about 13 moves, the friction is structural, not a tuning number: the idea needs a design change, and that is the owner's decision.

## What the toys revealed

The idea research built small playable toys of five finalists and ran simple bots against their rules. The numbers decided which ideas survived:

| Game | What the bots showed | Verdict |
|---|---|---|
| Line Siege | The first move fires a beam and defeats a monster; the preview shows which monster a column hits. As first specced, the pace was near-unwinnable: a bot lost all 200 games within about 6 placements. Easing two pacing numbers (monsters march every 2nd placement, spawn every 3rd) roughly doubled survival. | Kept; balance needs design work, which bots can do |
| Scrap Shove | Robots crash within 2-3 taps and a floor takes a few turns, but over 300 simulated games a one-move-lookahead bot got about 0.25 chances per game to crush a robot with scrap; almost all wins came from classic robot-on-robot crashes. | Twist too weak (twist score lowered); the twist needs strengthening before building |
| Snare Snake | Closing a loop reads instantly, but catching anything does not happen within seconds: enclosing one cell takes an 8-segment ring, the starting snake has length 5, and critters slip out while the loop is drawn. A search that could see every future critter move found no catch within 13 moves from the start; a greedy bot caught 1 critter in 20,000 moves. | Killed (structural friction, not a tuning number) |
| Merge Siege | Feedback is instant (merge pop, smash burst), but most clashes are one-for-one trades; every simulated run ended "Overrun" in about 15-20 moves. | Dropped: the decision is murky and naive and smart play end alike |
| Flock Tilt | A BFS solver proves every generated field winnable and gives par (about 13 ms for 50 fields). A random swiper wins only about 12 % of fields and takes about 2× par when it does. | Kept: the puzzles need thought (a clear skill gap) |

Lessons that became rules:

- Measure the twist, not just the win rate (Scrap Shove passed on fun and failed on twist).
- Use a future-seeing search as the upper bound before declaring an idea dead (Snare Snake).
- A random bot that loses about as fast as a smart one means choices do not matter (Merge Siege).
- Pacing numbers from a spec are guesses; the first sim run usually shows the game is far too hard or too easy (Line Siege).

## Designing the opening for an early payoff

The fastest fix for a late first payoff is the opening layout, generated from the seed like everything else:

- **Line Siege:** one column is two cells short and one row is two cells short; the tray holds a random block plus the vertical and horizontal two-cell bars that finish them; a weak normal monster (6-8 health, one beam deals 8) waits at row 1 of the prepared column's lane, two more normal monsters stand in other lanes, and 6 loose blocks never complete a line. The first placement can fire a beam and defeat a monster: the greedy bot does so on move 1 in every run of the report, and the example's `create.test.ts` and `opening.test.ts` prove the prepared lines and the weak monster for random seeds.
- **Scrap Shove:** the toy's robots crash within 2-3 taps; keep a robot pair near a collision in every opening so the first crash comes that fast.
- **Puzzle games (Flock Tilt):** the payoff is solving the field, so keep the first fields' par short (the toy's field 1 has par 4, with a deliberate trap in the obvious first tilt) and measure the payoff as "penned within par".

Test the opening directly (a unit test over many seeds: "some first move produces a payoff event"), then let the sim's `firstPayoff` rule guard it.

## Payoff and twist events for the first games

Starting suggestions; each game confirms its own in its design pass:

| Game | `payoff` | `twist` |
|---|---|---|
| Line Siege | `monster-defeated` | `beam-fired` with a target: a cleared column's beam hits a monster |
| Scrap Shove | robots crash | a shoved scrap heap wrecks a robot |
| Flock Tilt | sheep penned | a sheep stopped by another sheep lands in the pen |
| Snare Snake | critter captured | a loop closed around a critter |
| Merge Siege | enemy smashed | a merged tile smashes an enemy it could not beat before |

## When a game fails: stop and ask

If the kill test fails after reasonable tuning (the opening is prepared, the pressure is calm, and even the lookahead bot cannot reach an early payoff or a regular twist), do not keep polishing. Stop and tell the owner in plain words: what the bots measured, what was tried, and one or two design changes that would address it. The owner decides whether to change the idea, move it down the catalogue, or drop it. The owner's own play-test is the final judge of fun in every case: bots measure pace, not joy.
