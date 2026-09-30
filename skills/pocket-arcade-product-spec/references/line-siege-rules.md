# line-siege-rules · Line Siege v1 rules

The complete rules of Line Siege v1, the pilot game (catalogue number 1, `line-siege`), as the rules engine, the sims, the levels, the board and the copy implement them. Every number here is a **default until the owner's play-test**: the tuning file holds each one as a named knob, and changing one means a sim run and regenerated level packs. `spec-lookup.mjs line-siege-rules` prints this sheet; `spec-lookup.mjs line-siege` prints the catalogue entry.

## Contents

- The board, the lanes and the tray
- The pieces
- One placement, step by step
- Monsters
- Winning, losing and the score
- Difficulty, levels, the daily and endless
- Continue, hints and undo
- What the player sees and hears
- Measured balance
- Owner questions

## The board, the lanes and the tray

- **Board:** 8 x 8 cells (`TUNING.boardSize` 8), row-major, index = row x 8 + col; a cell is empty (0) or holds a block (1).
- **Lanes:** one lane per board column (8 lanes), each 6 lane rows long (`laneRows` 6). Lane row 0 is the far end; a monster that reaches row 6 breaks the wall. On screen the lanes are a band above the board (half a cell per lane row), the wall sits between the lanes and the board, and the hearts are drawn on the wall.
- **Hearts:** 3 at the start; each breach costs one.
- **Tray:** 3 slots, each a piece index or empty. The three slots refill together, only once all three are used.

## The pieces

10 fixed shapes, given as `[dx, dy]` offsets from the top-start anchor cell. There is no rotation: a piece is placed as offered.

| # | Shape | Offsets |
|---|---|---|
| 0 | single | `[0,0]` |
| 1 | horizontal two | `[0,0] [1,0]` |
| 2 | vertical two | `[0,0] [0,1]` |
| 3 | horizontal three | `[0,0] [1,0] [2,0]` |
| 4 | vertical three | `[0,0] [0,1] [0,2]` |
| 5 | 2 x 2 square | `[0,0] [1,0] [0,1] [1,1]` |
| 6 | L | `[0,0] [0,1] [1,1]` |
| 7 | L | `[0,0] [1,0] [0,1]` |
| 8 | L | `[0,0] [1,0] [1,1]` |
| 9 | T | `[0,0] [1,0] [2,0] [1,1]` |

## One placement, step by step

The only move is `place-block` (a tray slot and the board cell of the piece's anchor). It is legal when every cell of the piece is on the board and empty. `listMoves` returns every fitting placement in a fixed order, and it is empty exactly when the run is over. Then, in this order:

1. The block is placed.
2. Every full row and every full column clears at once.
3. Each cleared column fires a beam up its lane, in column order: 8 damage (`beamDamage`) to the living monster of that lane nearest the wall (on a tie, the lower id).
4. One shockwave deals 2 x the number of cleared rows (`shockDamage` 2) to every monster that is not armoured.
5. Monsters at 0 health are defeated.
6. Score: + lines² x 10 + 25 per defeated monster, where lines = rows + columns cleared by this placement (so a double scores 40, a triple 90).
7. Every `marchEvery`-th placement the monsters march: a normal or armoured monster 1 lane row, a fast one 2. Each monster that reaches row 6 costs one heart and is removed.
8. While hearts are left, a monster spawns when the wave has monsters left (always in endless) and either the placement count is a multiple of `spawnEvery` or the lanes are empty. It enters at row 0 of a lane drawn from the run's RNG, with its kind drawn by the row's weights and its health uniform in [hpMin, hpMax] (endless adds floor(placements / 12)).
9. The tray refills when all three slots are used.

## Monsters

| Kind | What it does | Drawn as |
|---|---|---|
| normal | the plain monster | violet |
| armoured | shockwaves bounce off; only beams hurt it | slate, with an outline ring |
| fast | moves 2 lane rows per march | pink, with a chevron |

Every monster shows its health. The colour-blind palettes use the Okabe-Ito colours, and the kinds differ by shape as well as colour.

**The opening** (`create`) is built so the first placement can already fire a beam and defeat a monster: one prepared column and one prepared row, each two cells short; the tray offers a random piece, the vertical two and the horizontal two; a weak normal monster (health 6 to 8) waits at lane row 1 of the prepared column's lane and two normal monsters stand in other lanes (all three count as spawned); 6 loose blocks never complete a line.

## Winning, losing and the score

The outcome is checked in this order:

1. No hearts left: **lost**, `line-siege.lose.broke-through` ("The monsters broke through").
2. The wave is over (every monster of the level's `goal` has entered and none is left; never in endless): **won**, with the score.
3. No tray block fits anywhere: **lost**, `line-siege.lose.board-full` ("No room left for the blocks").
4. Otherwise the run goes on.

This is a deliberate exception to "a win beats a loss": a breach of the last heart loses even when that monster was the wave's last. A win does beat a full board.

The score is the number the HUD, the result screen (S7) and the stars use (`state.score`). Defeats, beams and the biggest combo are statistics counters (`monsters-defeated`, `beams-fired`, `biggest-combo`), not the score.

## Difficulty, levels, the daily and endless

One difficulty scale, 0..100. Levels and the daily use 0..99 through four tuning rows (0-24, 25-49, 50-74, 75-99); 100 is the endless run.

| Row | Difficulty | Wave (`goal`) | March every | Spawn every | Health | Weights normal : armoured : fast |
|---|---|---|---|---|---|---|
| 0 | 0-24 | 4 | 6 | 6 | 3-5 | 1 : 0 : 0 |
| 1 | 25-49 | 5 | 4 | 4 | 4-7 | 3 : 0 : 1 |
| 2 | 50-74 | 6 | 4 | 3 | 5-8 | 2 : 1 : 1 |
| 3 | 75-99 | 7 | 4 | 3 | 6-9 | 2 : 1 : 1 |
| endless | 100 | none (never won) | 4 | 3 | 4-7, + 1 every 12 placements | 2 : 1 : 1 |

- **Levels:** 3 packs of 30 (`first-wave`, `stronger-foes`, `last-stand`; names `line-siege.pack-name.1` to `.3`). Level difficulty = floor((level - 1) x 99 / 89): 0 at level 1, 99 at level 90. Each level is proven winnable by a witness (the greedy bot from the fixed seed `0x5bd1e995`, up to 60,000 moves shown); a level the witness wins in fewer than 8 placements is rejected. Stars by score: [0, the witness score (at least 1), that score + 20 % (at least + 1)]; clearing the wave wins whatever the score.
- **Daily:** salt `0xe8c0`, difficulty 45 (row 1).
- **Endless:** `create(freshSeed, 100)`; the wave never ends and health rises, so a run only ends lost. Its result shows "New best!" whenever the score beats the stored best. No stars.
- **Modes** (`game.config.ts`): levels, daily and endless on; `isContinueAllowed: true`; `hints.freePerDay: 0`; age-rating violence `INFREQUENT_OR_MILD`.

## Continue, hints and undo

- **Continue** (spec 8.10, one per run): `line-siege.continue.push-back` ("One more go: the monsters fall back and the board clears a little"). It rescues both losses: hearts = max(hearts, 1); every monster moves back 3 lane rows (never past row 0); when no block fits, the 2 fullest board rows are emptied (no score, no beams, no shockwave); then the tray is redrawn (with the single block in the first slot if nothing drawn would fit).
- **Hints:** none. There is no exact solver to suggest a best move.
- **Undo:** unlimited.

## What the player sees and hears

- **HUD:** the score; the goal line `line-siege.progress` ("Monsters {defeated} / {total}") on a level, `line-siege.progress.endless` ("Monsters {defeated}") in endless.
- **Input:** drag a tray block onto the board, or tap a block and then tap a board cell (the selection is shown as a ring on the tray slot and is never a move). The block lands where its ghost was shown.
- **Board summary** for VoiceOver: `line-siege.board.summary` ("{monstersCount} monsters in the lanes, {heartsCount} hearts left", with plural forms).
- **Cues** (sound and haptic): place (light), beam (medium), shock, hit, pop (success), breach (warning); the sound bank holds exactly these six.
- **Paints:** background, lane, wall, cell, block, ghost, beam, shock, number, tray, heart, and one per monster kind.
- **Teaching** (tutorial and how-to-play, four steps each; the copy deck's `games.lineSiege.tutorial` and `howToPlay`): the fourth step says how the monsters move. The lead reworded it on 2026-09-30 (decision L4) so it matches the tuned march:

| Key | en | de | fa (native review) | ckb (native review) |
|---|---|---|---|---|
| `line-siege.how-to-play.step-4` | The monsters march closer every few blocks. | Alle paar Blöcke rücken die Monster näher. | هیولاها هر چند بلوک یک‌بار نزدیک‌تر می‌آیند. | دێوەکان هەر چەند بلۆکێک جارێک نزیکتر دەبنەوە. |
| `line-siege.tutorial.step-4` | Careful: the monsters march closer every few blocks. | Achtung: Alle paar Blöcke rücken die Monster näher. | مراقب باشید: هیولاها هر چند بلوک یک‌بار نزدیک‌تر می‌آیند. | ئاگادار بە: دێوەکان هەر چەند بلۆکێک جارێک نزیکتر دەبنەوە. |

"Every few blocks" holds for any march cadence of 2 or more (`marchEvery` >= 2 in every tuning row), so retuning within that range needs no new copy; a march after every block (`marchEvery` 1) would need the owner's new wording first.

## Measured balance

The balance sims (100 seeds per cell, rows sampled at 0/25/50/75, endless separately) with the defaults above:

| Bot | Difficulty 0 | 25 | 50 | 75 |
|---|---|---|---|---|
| greedy win rate | 0.73 | 0.56 | 0.39 | 0.14 |
| random win rate | 0.22 | 0.14 | 0.11 | 0.02 |
| lookahead win rate | | 1.0 | | |

The first placement fires a beam that defeats a monster in every greedy run. Greedy endless runs last a median 26 placements, score a median 185 and land 2.35 beam hits per run; about half end on a full board. The first tuning (march every 3rd placement in the last row) fell off a cliff at 0.04 and was eased to 4. Marching every placement, as the catalogue's first sketch had it, made greedy win 0.16/0/0/0, so the march cadence is a per-difficulty knob.

## Owner questions

1. **Answered by the lead on 2026-09-30 (L4): the teaching copy now matches the tuning.** The copy deck used to say "After each block you place, the monsters march one row closer" (how-to-play step 4) and "the monsters step closer after every block" (tutorial step 4), while the tuned game marches every 4 to 6 placements. The lead reworded both steps in all four languages to "The monsters march closer every few blocks" (texts under "What the player sees and hears"), in the design copy deck and the mockup. The owner is told in the lead's report; fa and ckb await the native review.
2. Is choosing a line because of where a monster is enjoyable? Does the beam feel satisfying? Is the screen readable at phone size? (The toy's questions, still open.)
3. Are 3 hearts, 6 lane rows, 4 to 7 monsters per wave and the four difficulty rows the right pace? All are knobs.
4. Is a breach of the last heart that ends an otherwise cleared wave a fair loss?
5. Should the continue also restore more than one heart, or clear more than two rows?
