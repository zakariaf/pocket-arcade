# Toggle Drop: design notes

Game 9 of the catalogue (`toggle-drop`), epic E26. Written 2026-10-19 before any code, answering every question of new-game-scaffold's "Before code" checklist. Each section gives the proposed answer, the reason, and what changes if the owner answers differently. Spec lines are quoted from `spec-lookup.mjs toggle-drop 13 12 10 11 8.1 8.2 8.3 8.5 8.10 D2 D9`, never from memory.

## The spec lines this game serves

- Catalogue (spec 13, `toggle-drop`): "Catalogue number 9. Ball drop through a peg board where every peg is a flip-flop switch. Risk: may read as a cold bookkeeping puzzle rather than the chaotic fun of peg games. Engine: the drop is simulated inside the move and replayed."
- Spec 13: "Each game gets its own design pass, approved by the owner, before it is built."
- Spec 10 RULES: "Start state for a level (from its seed and difficulty)." "The list of moves allowed in a state." "'Apply a move': returns the new state plus a list of events (what happened, for animations and sounds ...)." "'Is it over?': win, lose (with a reason), or still playing." "Score and the goal/progress line for the top bar." "Whether undo, hints and continue are supported, and how continue works."
- Spec 8.1: "Levels are generated from a seed number plus a difficulty, not drawn by hand. The same seed always makes the same level. Where the game allows it, each level is checked by a solver before it ships, so no level is impossible, and the solver also calculates 'par' (the best possible result)." "Puzzle games: 3 stars at or under par, 2 stars at par +2, 1 star for finishing."
- Spec 8.2: "DAILY | One generated level per day (8.3). On by default"; "ENDLESS | For games with no natural end ... Optional per game".
- Spec 8.3: "The level number comes from today's local date plus the game's own salt, run through the same generator as normal levels, at a medium difficulty."
- Spec 8.5: "Undo: if the game supports it. The Shell keeps a history of states, and Undo steps back one move (unlimited in puzzle games; the game can limit it)." "Hints: if the game supports it. The game's solver suggests the next good move, and the Shell highlights it. Hint budget: 1 free hint per day, then a rewarded ad per hint, or unlimited with Premium (decision D2)."
- Spec 8.10: "When no continue can be offered, the result appears at once (S7); a finished run never waits for an offer that cannot come (decided 2026-10-01, lead decision L11)."
- D9: "Default: 3 packs x 30 levels, plus Daily; Endless where it fits." D2: "Default: removes all ads, and hints and continues become free. Levels are never sold."

## 1. What it is

**Proposed:** A ball drops through a peg board where every peg is a flip-flop switch. Tap a column to drop a ball; every switch it passes sends it left or right and flips; fill the target cups with the fewest drops.

The rules, exactly:

- The board has 5 to 7 **columns** and 3 to 5 **peg rows**. Some cells of a peg row hold a **switch**; each switch points left or right.
- A **drop** picks a column. The ball falls row by row. At a row where its column holds a switch, the switch sends it one column to the side it points to and then **flips** to the other side. At the board's edge a switch that points into the wall lets the ball fall straight on (it still flips).
- Under the last row each column ends in a **cup** or in the **gutter**. A cup needs 1 or 2 balls; a ball that lands in a cup that still needs one fills it, any other ball is lost in the gutter.
- The player has a fixed number of **balls** for the board. **Won** when every cup is full; **lost** when the last ball is spent and a cup is still not full.
- Nothing is random after the board is made: the same drops always give the same falls, so the solver can prove every board and give par.

**Reason:** the catalogue's own pitch, kept small for v1 (switches and cups only: no fixed pegs, bumpers or moving parts; spec 13's lesson that Claude over-delivers scope).

**If the owner answers differently:** extra piece kinds (a fixed peg, a cup that empties) are a new rule in the rules layer, test-first, and a tuning change regenerates the packs.

## 2. Classification

**Proposed:** simulate-then-replay. The ball's fall through the switches runs inside `applyMove` on the game kit's fixed step (1/120 s): the ball falls at a constant speed in whole sub-units, meets each peg row, is sent one column left or right (or straight on at a wall), and every switch it passes flips. The fall returns ordinary events with times (`atMs`) and always stops at a `maxTicks` cap; the board replays them as a timeline. Saving, undo, bots and goldens stay turn-based (one move = one drop).

**Reason:** game-rules-engine's classification table lists Toggle Drop as simulate-then-replay; the catalogue says "the drop is simulated inside the move and replayed".

**If different:** nothing a player sees changes; only the animation would be built from untimed events.

## 3. Input

**Proposed:** a tap on the column to drop from (`engine.panMode` `'none'`, `selectRegions` `[]`). The whole column, from the drop chute at the top to its cup, is the tap target, so every target is far above 44 pt (a 374 pt wide board with 7 columns gives 53 pt columns).

**Reason:** one tap is the most phone-friendly input of the catalogue; a column is a big target.

**If different:** a drag-to-aim chute would be `'drag'` and a new `intentToMove` case.

## 4. Modes

**Proposed:** Levels + Daily (spec 8.2; daily on by default). No Endless: a board ends when its cups are full, so Home shows no Endless card (`modes.endless` false).

**If different:** an endless run would need an endless tuning row (difficulty 100, never won) and a board that refills its cups.

## 5. Packs

**Proposed:** 3 packs of 30 levels (D9), unlocked by stars (S8: 0, 45 and 90 stars). Pack names: "Warm-up board", "Switchyard", "Grand cascade" (de "Aufwärmbrett", "Weichenhof", "Große Kaskade"; fa and ckb drafts in the copy deck for the owner's review).

## 6. Stars

**Proposed:** the puzzle rule of spec 8.1, rated by drops against par: 3 stars at or under par, 2 stars at par + 2, 1 star for finishing. The S7 win shows "7 moves – par 7" (the base `s7-result-win` reference: game fact `winLine: "moves"`).

**Reason:** every board is fully determined, so the BFS solver proves it and gives par.

## 7. Undo

**Proposed:** unlimited (a puzzle game, spec 8.5), never across a continue (there is none).

## 8. Hints

**Proposed:** `solver`: the hint is the first drop of the shortest line from the current position that fills every cup with the balls left, found by the same BFS solver; a won or lost position, or one that can no longer be won, has no hint. The Shell highlights the hinted column only after it is paid for: 1 free a day, then a rewarded ad, unlimited with Premium (8.5, D2). So `hints.freePerDay` is 1, the game fact `hasHints` is true and S5 shows the hint key.

**If different:** `--hints none` hides the key (L8) and `freePerDay` becomes 0.

## 9. Continue

**Proposed:** `none`. S7 offers no continue and the result shows at once (8.10, L11). `isContinueAllowed` false.

**Reason:** in a puzzle with unlimited undo a rescue adds nothing; undo already gives every ball back.

## 10. Ways of losing

**Proposed:** one: `toggle-drop.lose.out-of-balls` ("You ran out of balls"), S7's short, friendly reason.

## 11. Score and the top bar

**Proposed:** the top bar's number is the **balls left**; a win scores the balls left over (a whole number >= 0). On a level the Shell's goal line shows "Moves 3 / Par 4"; in the daily it shows the game's progress line "Cups 1 / 3". The board also shows the remaining balls in a rack above the columns.

## 12. Counters (S10)

**Proposed:** three sums, counted from the kept move line's events: Balls dropped (`balls-dropped`, sum of `ball-dropped`), Switches flipped (`switches-flipped`, sum of `switch-flipped`), Cups filled (`cups-filled`, sum of `cup-filled`).

## 13. Events

`ball-dropped { col, atMs }`, `switch-flipped { col, row, side, atMs }` (side = the new side), `ball-landed { col, cup, redirected, atMs }` (`cup` true when it filled a cup; `redirected` true when a switch an earlier ball had flipped sent it on its way), `cup-filled { col, atMs }`. Past tense, kebab-case, each with every id the animation, the sounds and the counters need.

## 14. Music and sounds

**Proposed:** no music (L1), so S6 and S11 drop the Music rows and parity uses the `--no-music` references. Synthesised sounds: the drop, a click per switch, a cup pop, win and lose; haptics on cup, win and lose (respecting Vibration).

## 15. Age rating

**Proposed:** cartoon or fantasy violence `NONE` (step G1): balls, switches and cups, nothing is ever hit.

## 16. Daily

**Proposed:** the daily is a level at difficulty 45 (a medium value, 8.3), with Toggle Drop's own salt `0xcbcb` (the scaffold's suggestion, fixed forever in `src/levels/toggle-drop-levels.ts` in E26-T08; never shared with another game).

## 17. Bands and the kill test (proposed, for the bot sims of E26-T07)

Four tuning rows on the 0..99 scale (rowFor: 0-24, 25-49, 50-74, 75-99), each clearly harder:

| Row | Columns | Peg rows | Switches per row | Cups (balls each needs) | Balls |
| --- | ------- | -------- | ---------------- | ----------------------- | ----- |
| 0   | 5       | 3        | 2                | 2 (1, 1)                | 6     |
| 1   | 5       | 4        | 2                | 3 (1, 1, 1)             | 7     |
| 2   | 6       | 4        | 3                | 3 (2, 1, 1)             | 8     |
| 3   | 7       | 5        | 3                | 3 (2, 2, 1)             | 9     |

- **Curve:** par rises from about 2 on the first levels to 6 to 8 on the last; the greedy bot's win rate falls monotonically across the rows; random play loses most boards beyond the first row ("naive bots should lose").
- **Skill gap:** random < greedy < lookahead by a clear step.
- **Opening:** the first cup of every board sits where one drop from the start lands, so a first payoff is always one drop away.
- **Kill test:** on the easiest board the first cup fills within 1 to 3 drops in at least 90 % of greedy runs, and a switch flipped by one ball redirects a later ball into a cup (`ball-landed` with `cup` and `redirected`) at least once per run.
- The numbers are the first guess; the sims tune them one knob at a time, and the bands stay `"proposed"` until the owner's play-test (O6).

## 18. The risk, and what answers it

**Risk (catalogue):** "may read as a cold bookkeeping puzzle rather than the chaotic fun of peg games."

**Answers in v1:** every drop is a short, visible chain reaction (the ball zig-zags, each switch clicks and visibly flips, a cup pops and fills); the first payoff is one drop away on every board; the hint shows the next good column. A path preview before dropping is left out of v1 (scope cap); it is the first thing to add if the owner's play-test finds the game too dry.

## 19. The Toybox design pass

Toggle Drop is drawn into the Toybox design (`design/toybox.html`, `design/toybox/tokens.json`, `design/shared/copy-deck.json`) like Line Siege, Flock Tilt and Scrap Shove:

- **Paint** (`reports/toggle-drop/toggle-drop-paint.json`, passes write-palette's rules): light "Lilac wash" `#CEC6F5` ground, "Chalk" `#FBFAFF` surface, `#E8E3FB` sunken, "Bubblegum" `#FF7EB0` accent, "Lime ball" `#BDEB5C` pop; dark "Arcade night" `#1C1636`, "Cabinet" `#2C2454`, `#241D45` sunken, "Moonlight" `#F5F2FF` ink, "Dusk lilac" `#BBB0EA` muted, `#E6E0FF` outline, `#08061A` shadow, "Glow gum" `#FF91BD` accent, "Glow lime" `#C8F26E` pop.
- **Logo** on the 48 grid, six layers: a white switch lever tilted on its ink pivot and post, a lime ball dropping onto its high end (one pop accent with a white shine) and an ink arrow showing the flip.
- **Texts** in en, de, fa and ckb: name (Latin in every language), tagline, goal, progress line, win title, lose reason, three counter labels, four how-to-play steps, three tutorial steps and three pack names. The fa and ckb texts are drafts for the owner's own review (O6, step G7).
- **Tutorial** (three steps, E26-T13): a 4-column board with two switches and three cups; drop in column 2 (the ball goes left into the first cup and the switch flips), drop there again (it goes the other way, through a second switch, into the third cup), then drop in column 3 (the flipped second switch sends it into the last cup).

## 20. Ids and owner steps

- Bundle id `io.applander.toggledrop`, Premium `io.applander.toggledrop.premium` (O4), EUR 1.99, Family Sharing off (O2, O3). App Store name "Toggle Drop" (G1); App Store Connect record exists (G2, Apple ID 6824608821).
- G3 (privacy and support links) and G5 (AdMob ids): the scaffold's placeholders until the owner's values reach `game.config.ts` (L14).
