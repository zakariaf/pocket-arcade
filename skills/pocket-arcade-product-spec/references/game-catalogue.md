# 13 · The game catalogue

The 26 games Pocket Arcade plans to ship, one app each, in suggested build order, with what the idea hunt (2026-09-23) learned about each. Each game gets its own design pass, approved by the owner, before it is built. Game ids are the kebab-case working titles; they name the app folder and are stable forever.

## Contents

- How the ideas were chosen (filters, scores, research lessons)
- Ready to build: line-siege, flock-tilt, scrap-shove
- Need a design fix first: snare-snake, merge-siege
- Good candidates, not yet prototyped: jump-chain, stepstone, swap-guard, toggle-drop, poker-drop, trail-clear, dig-site, floodline, sonar-hand, deep-sweep, grove-shift, rank-ladder
- Need special care: letter-bugs, exact-zero, dice-foundry, fuseban, ripple-ten, dock-slide, last-stop, bank-shot, halo-drift
- What the catalogue means for the Shell

## How the ideas were chosen

The idea hunt found 26 distinct ideas (32 candidates before merging duplicates). Every idea passed the hard filters: 2D, single-player, fully offline, art and sound made in code, nothing to install, and an original look possible.

Scoring (1-5 per criterion; "Fun & clarity" and "Claude can verify" count double; maximum 45): fun and clarity, Claude can verify it, code-only art, replay without hand-made content, scope, fresh twist, controls and session length.

| Game | Fun (x2) | Verify (x2) | Art | Replay | Scope | Twist | Controls | Total | Toy result |
|---|---|---|---|---|---|---|---|---|---|
| Line Siege | 4 | 5 | 5 | 5 | 4 | 3 | 4 | 39 | passes |
| Scrap Shove | 4 | 5 | 5 | 4 | 5 | 2 | 5 | 39 | passes; twist rarely matters |
| Flock Tilt | 4 | 5 | 4 | 3 | 4 | 3 | 5 | 37 | passes |
| Snare Snake | 3 | 5 | 5 | 4 | 5 | 3 | 4 | 37 | dropped: catching anything takes 30-60+ taps |
| Merge Siege | 3 | 5 | 5 | 4 | 4 | 2 | 5 | 36 | dropped: most clashes are one-for-one trades |

Research lessons that shape every game:

- The winning shape is "a base everyone knows, plus one twist that changes decisions" (Balatro, Dragonsweeper, RogueSlide, Ball x Pit, Nubby's Number Factory, Is This Seat Taken?).
- Phones favour short, turn-based puzzle and card loops. The median mobile session is 5-6 minutes; board, card and puzzle games keep players longest. Reviewers praise "completely offline" play and complain about misclicks on small screens.
- Code-only art can carry a hit if it has one clear visual idea (Mini Metro ruled out hand-built levels, art-heavy work and reliance on audio content from the start).
- AI agents build the playable core of small 2D games reliably but fail silently on rules, balance, level design and input wiring: a game can "look right" while nothing responds to input; checking state directly beats letting an agent "play" (92.2% vs 58.8%). So turn-based grid games with small, inspectable state are the most verifiable, and real-time physics and precision platforming the least.
- Touch controls are a real cost: taps and swipes are safer than virtual sticks, and a touch drag needs a finger offset.
- Claude Code writes its own bots and headless simulations when the design allows it, and tends to over-deliver scope (8 weapons when 3 were asked), so v1 content needs a cap.
- "Naive bots should lose" is a design test: if a script beats the game, it is not a puzzle.
- The kill rule: an idea must be fun within seconds in its toy; a structural friction (not a tuning number) drops it.

## Ready to build (toys exist and passed)

### line-siege · Line Siege

- Catalogue number 1. The pilot game (decision D1). Modes: Levels + Endless + Daily.
- Pitch: the block puzzle everyone knows, except every column cleared fires up its lane at the monsters marching toward the player.
- Core loop: place one of three offered blocks; full rows and columns clear. A cleared column shoots its lane (8 damage to the lowest monster); a cleared row sends a shockwave that hits every monster for 2; the monsters then step toward the wall, and each one that breaks through costs a heart.
- The twist: players stop clearing whatever line is nearly full and choose which line to finish by where the threat is. The toy shows a ghost of the block plus a highlight on the lane that column would hit, before the player commits.
- Controls: tap a block, then tap the grid (dragging works too). One input.
- Sessions: a run lasts 3-10 minutes; runs are endless and seeded, with a daily seed.
- Art and sound: flat coloured squares and geometric monsters showing their health; a beam flash up the lane, damage numbers and pop bursts; synthesized zaps.
- How Claude tests it: placement, clears, damage and marching are pure functions on an 8x8 array; pieces and waves come from a seed; bots play thousands of runs to tune the pace.
- v1 content: one board, about 10 block shapes, three monster kinds (normal, armoured, fast), endless waves and a daily seed.
- Risks: balance (as first specced, a bot lost every game within about 6 placements; the toy eased the march to every 2nd placement and spawns to every 3rd, which roughly doubled survival; real pacing needs bot tuning, so the march and spawn cadence is a per-difficulty knob of the tuning table: v1 marches every 6th placement in the easiest row and every 4th after it); phone layout (lanes and board must share the screen; they fit in the toy); originality (block-puzzle RPG hybrids probably exist, so the aimed clear must stay the headline).
- Owner questions from the toy: is choosing a line because of where a monster is enjoyable? Does the beam feel satisfying? Is the screen readable at phone size?
- **The complete v1 rules** (board, lanes, tray, the 10 pieces, the placement order, monster kinds, health, spawns, hearts, win, score, endless, tray refill, the full-board loss, continue, difficulty rows, levels, daily, measured balance and the open owner questions) are in [line-siege-rules.md](line-siege-rules.md) (`spec-lookup.mjs line-siege-rules`). Every number there is a default until the owner's play-test.

### flock-tilt · Flock Tilt

- Catalogue number 2. Modes: Levels + Daily.
- Pitch: tilt the whole field and every sheep slides at once; pen them all without bumping the wolf.
- Core loop: look at the field and tilt it; everything slides until it hits something; sheep that reach the pen drop in; undo freely, then move on to the next field.
- The twist: the player never moves one animal, so sheep are each other's blockers. The wolf slides by the same rules, and any sheep that ends up against it is lost.
- Controls: swipe in 4 directions (or tap a side), plus Undo.
- Sessions: a field takes 30-90 seconds; a daily set plus endless generated fields.
- Art and sound: a fenced field, round sheep, an angular wolf, rocks; sliding squash and bump effects; a burst when a sheep is penned; synthesized bleats and thuds.
- How Claude tests it: every field is generated from a seed and proven winnable by a solver (BFS) that also computes par (about 13 ms for 50 fields in the toy). A random swiper wins only about 12% of fields and takes about 2x par when it does, which shows the puzzles need thought.
- v1 content: one 7x7 field, rocks, a pen, sheep and 1-2 wolves; generated fields with par 3-8 and a daily set.
- Risks: samey puzzles without a quality score; too much planning for casual players; a familiar tilt-and-slide base (RogueSlide is on phones); the wolf rule must stay gentle for the age rating. The toy's extra: a "Looks stuck - Undo?" hint that uses the solver.
- The pick for players who prefer calm, short brain-teasers over a battle.

### scrap-shove · Scrap Shove

- Catalogue number 3. The twist needs strengthening first.
- Pitch: robots chase the player one step at a time and wreck themselves when they crash; shove the wreckage into their path.
- Core loop: step or shove, then every robot steps toward the player; crashes turn robots into scrap; clearing a floor brings a new one with more robots.
- The twist: scrap heaps are not just obstacles; the player pushes them like crates to block a robot or crush one behind the heap.
- Controls: tap a square next to the player (tap the player to wait). The most phone-friendly input of the three.
- Sessions: a floor takes 1-2 minutes; a run 5-10 minutes.
- How Claude tests it: one pure step function, deterministic robots, a small search proves every floor winnable and gives par; bots tune difficulty.
- v1 content: one grid size, scrap, three robot kinds (normal, fast, heavy), floors that get denser.
- Risks: the twist barely shows up (over 300 simulated games a one-move-lookahead bot got about 0.25 chances per game to crush a robot with scrap; the base is the 1976 game Chase); short runs; floor 1 can corner the player quickly.

## Need a design fix first (toys found problems)

### snare-snake · Snare Snake

- Catalogue number 4. Turn-based Snake where crossing the snake's own body closes a loop, captures critters inside and spends those segments.
- Problem: catching took too long in the toy. Enclosing even one cell takes an 8-segment ring, so the starting snake (length 5) cannot catch anything, and critters slip out while the loop is drawn. A greedy bot caught 1 critter in 20,000 moves. This is structural friction, not a tuning number.

### merge-siege · Merge Siege

- Catalogue number 5. 2048-style swipe merging while numbered enemies march in; bigger tiles smash smaller enemies.
- Problem: clashes felt like trades. All tiles move at once, so most clashes become one-for-one trades; every simulated run ended "Overrun" in about 15-20 moves. 2048 variants are saturated in the stores.

## Good candidates, not yet prototyped

### jump-chain · Jump Chain

Catalogue number 6. Solo checkers: one piece against advancing enemy ranks; only multi-jump chains clear them. Risk: the board-game roguelike space is crowded, and a close jam precedent exists (Tiny Checkers).

### stepstone · Stepstone

Catalogue number 7. Small-grid tactics where the tile the player stands on sets the next move (knight, rook, bishop...). Risk: 6-8 move glyphs are hard to read on a phone; chess roguelites are crowded.

### swap-guard · Swap Guard

Catalogue number 8. Telegraphed-attack tactics where the only move is swapping places, so enemies hit each other. Risk: many interacting systems (enemy types, resolution order) for a first version; overlaps Scrap Shove.

### toggle-drop · Toggle Drop

Catalogue number 9. Ball drop through a peg board where every peg is a flip-flop switch. Risk: may read as a cold bookkeeping puzzle rather than the chaotic fun of peg games. Engine: the drop is simulated inside the move and replayed.

### poker-drop · Poker Drop

Catalogue number 10. Drop cards into a 5-column well; poker hands in any line burst and cascade. Risk: clear-rate tuning; whether card imagery triggers a "simulated gambling" age rating is unconfirmed.

### trail-clear · Trail Clear

Catalogue number 11. Edge-matching tiles on a 5x5 board; closing a road or river loop scores it and wipes those tiles. Risk: dead positions, and "what gets wiped" is hard to read before committing.

### dig-site · Dig Site

Catalogue number 12. Number clues find hidden fossil skeletons of known shapes on a stroke budget. Risk (shared by the four deduction games): mine-deduction is crowded; players punish boards that feel unsolvable; flag-marking is awkward on touch.

### floodline · Floodline

Catalogue number 13. Number clues where flags are sandbags against a spreading flood. Same deduction risks as Dig Site.

### sonar-hand · Sonar Hand

Catalogue number 14. A hand of probe shapes, each counting the hidden wrecks inside its footprint. Same deduction risks as Dig Site.

### deep-sweep · Deep Sweep

Catalogue number 15. Mine-style clues on a collapsing descent; the ceiling collapses every few reveals. Same deduction risks as Dig Site.

### grove-shift · Grove Shift

Catalogue number 16. Wrap-around sliding rows where every moved tile ages a step. Risk: the goal is abstract and fails "understood in 30 seconds".

### rank-ladder · Rank Ladder

Catalogue number 17. Up-or-down card chains (golf solitaire) as a short run, editing the deck between deals. Risk: crowded card-roguelike space; deck-edit types need balancing.

## Need special care

### letter-bugs · Letter Bugs

Catalogue number 18. Swipe-to-spell letter grid where bugs crawl under the letters; spell through them to squash them. The strongest fun signal of any jam inspiration, but it needs a word list per language (en, de, fa, ckb), including offensive-word filtering; Persian and Sorani dictionaries (and their licences) are hard. Build late. Its board may opt in to RTL mirroring.

### exact-zero · Exact Zero

Catalogue number 19. Card duel on one shared countdown number; land it exactly on zero. Needs a card set and balance (content-volume risk); maths-niche.

### dice-foundry · Dice Foundry

Catalogue number 20. Place rolled dice on a 3x3 grid of machines that combo by adjacency, against rising rent. Content-heavy: engine-builders live on item count.

### fuseban · Fuseban

Catalogue number 21. Sokoban solved by placing timed charges whose blasts shove the crates. Very close to an existing jam game (Research & Detonation); needs its own twist; a pure level puzzle.

### ripple-ten · Ripple Ten

Catalogue number 22. Box numbers that sum to ten; every neighbour of the cleared box goes up by one. Very close to Make Ten; needs its own twist; narrow maths audience.

### dock-slide · Dock Slide

Catalogue number 23. Slide-merge puzzle where edge docks post timed orders the player ships tiles out to fill. Close to 2048/Threes; store copycat risk.

### last-stop · Last Stop

Catalogue number 24. Seat ferry passengers by their wishes as they board stop by stop. Close to an award-winning game (Is This Seat Taken?, 2026 Apple Design Award); copycat risk.

### bank-shot · Bank Shot

Catalogue number 25. Ball volleys where each wall bounce before a hit doubles damage. Physics feel is hard to test automatically; Ballz clones are plentiful. Engine: volleys are simulated inside the move and replayed.

### halo-drift · Halo Drift

Catalogue number 26. One-thumb real-time arena (survivors-like) where the ring orbiting the player is the only weapon. Feel-heavy, least testable; upgrade content creeps. Engine: a fixed-step real-time loop.

## What the catalogue means for the Shell

- It must support turn-based games (most of the list) and real-time games (Bank Shot, Halo Drift), both tap/swipe and drag input, and games with or without levels (endless-only).
- The Shell must not assume a grid.
- Suggested order: the best-tested ideas first, then the ones needing design work, then the risky ones. After the pilot, Flock Tilt and Scrap Shove are next in line.
- Several ideas are near-copies of existing games (Last Stop, Dock Slide, Ripple Ten, Fuseban) and would face store copycat rejection unless reworked.
