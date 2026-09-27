# E07 shortlist: pick the 2D game

Reading time: about five minutes. The sources and the reasons behind every score are in [research-notes.md](research-notes.md).

**Recommendation: Line Siege.** It's the block puzzle everyone knows, except every column you clear fires at monsters marching toward you. The two alternatives are Scrap Shove and Flock Tilt. You can play all three in the toys in `idea-hunt/toys/`.

## 1. Finalists and scores

All finalists pass every hard filter: 2D, single-player, fully offline, art and sound made in code, nothing to install, and an original look.

Each criterion is scored 1-5. Fun and Verify count double, so the maximum is 45. The scores include what each toy revealed.

| Working title | Fun & clarity (x2) | Claude can verify (x2) | Code-only art | Replay without hand-made content | Scope | Fresh twist | Controls & sessions | **Total** | Toy |
|---|---|---|---|---|---|---|---|---|---|
| **Line Siege** | 4 | 5 | 5 | 5 | 4 | 3 | 4 | **39** | passes |
| **Scrap Shove** | 4 | 5 | 5 | 4 | 5 | 2 | 5 | **39** | passes; twist rarely matters |
| **Flock Tilt** | 4 | 5 | 4 | 3 | 4 | 3 | 5 | **37** | passes |
| Snare Snake | 3 | 5 | 5 | 4 | 5 | 3 | 4 | 37 | dropped: catching anything takes 30-60+ taps |
| Merge Siege | 3 | 5 | 5 | 4 | 4 | 2 | 5 | 36 | dropped: most clashes are one-for-one trades |

The two dropped toys are still in `toys/` (`snare-snake.html`, `merge-siege.html`) if you're curious. They aren't part of the pick.

## 2. The top three

### Line Siege: `toys/line-siege.html` (recommended)

- **Pitch:** The block puzzle everyone knows, except every column you clear fires up its lane at the monsters marching toward you.
- **Target experience:** Tidying a grid where every tidy move is also an aimed attack. Calm hands, tense choices.
- **Core loop:** Place one of three offered blocks, and full rows and columns clear:
  - a cleared column shoots its lane (8 damage to the lowest monster);
  - a cleared row sends a shockwave that hits every monster for 2;
  - the monsters then step toward the wall, and each one that breaks through costs a heart.
- **The twist:** You stop clearing whatever line is nearly full and start choosing which line to finish by where the threat is. The toy shows this before you commit: a ghost of the block, plus a highlight on the lane that column would hit.
- **Controls:** Tap a block, then tap the grid (dragging works too). One input.
- **Session length:** A run lasts 3-10 minutes. Runs are endless and seeded, and there's a daily seed.
- **Art and sound:**
  - Art: flat coloured squares and geometric monsters showing their health.
  - Juice: a beam flash up the lane, damage numbers and pop bursts.
  - Sound: synthesized zaps.
- **How Claude would test it:**
  - Placement, clears, damage and marching are pure functions on an 8x8 array, and pieces and waves come from a seed.
  - Bots play thousands of runs to tune the pace.
  - Scripted taps must place blocks and change monster health. The toy already passes this check with mouse and touch.
- **v1 content in one line:** One board, about 10 block shapes, three monster kinds (normal, armoured, fast), endless waves and a daily seed.
- **Main risks:**
  - **Balance.** As first specced, a bot lost every game within about 6 placements. I slowed the march and the spawns for the toy, but the real pacing needs design work. Bots can do that tuning.
  - **Phone layout.** The lanes and the board must share a phone screen. In the toy they fit.
  - **Originality.** Block-puzzle RPG hybrids probably exist on the stores (unconfirmed), so the aimed clear must stay the headline.

### Scrap Shove: `toys/scrap-shove.html`

- **Pitch:** Robots chase you one step at a time and wreck themselves when they crash. Shove the wreckage into their path.
- **Target experience:** Feeling clever in a tight spot, turn after turn.
- **Core loop:** You step or shove, then every robot steps toward you. Crashes turn robots into scrap. Clearing a floor brings a new one with more robots.
- **The twist:** Scrap heaps aren't just obstacles; you push them like crates to block a robot or crush one behind the heap.
- **Controls:** Tap a square next to you (tap yourself to wait). One input, the most phone-friendly of the three.
- **Session length:** A floor takes 1-2 minutes; a run takes 5-10 minutes.
- **Art and sound:**
  - Art: a bright circle, angular robots, jagged grey scrap.
  - Juice: crash bursts and a small screen shake.
  - Sound: synthesized clanks.
- **How Claude would test it:**
  - The rules are one pure step function, and robot moves are deterministic.
  - A small search proves every floor can be won and gives par.
  - Bots tune the difficulty.
- **v1 content in one line:** One grid size, scrap, three robot kinds (normal, fast, heavy), and floors that get denser.
- **Main risks:**
  - **The twist barely shows up.** In 300 simulated games there were about 0.25 chances per game to crush a robot with scrap; the fun came from the classic crashes. Without a stronger twist, this is the 1976 game *Chase* with new paint.
  - **Short runs.** Games are brief, and floor 1 can corner you quickly.

### Flock Tilt: `toys/flock-tilt.html`

- **Pitch:** Tilt the whole field and every sheep slides at once. Pen them all without bumping the wolf.
- **Target experience:** The "aha" of finding the short solution when the obvious swipe is a trap.
- **Core loop:**
  - Look at the field and tilt it; everything slides until it hits something.
  - Sheep that reach the pen drop in.
  - Undo freely, then move on to the next field.
- **The twist:** You never move one animal, so sheep are each other's blockers. The wolf slides by the same rules, and any sheep that ends up against it is lost.
- **Controls:** Swipe in 4 directions (or tap a side), plus Undo.
- **Session length:** A field takes 30-90 seconds. A daily set, plus endless generated fields.
- **Art and sound:**
  - Art: a fenced field, round sheep, an angular wolf, rocks.
  - Juice: sliding squash and bump effects, and a burst when a sheep is penned.
  - Sound: synthesized bleats and thuds.
- **How Claude would test it:**
  - Every field is generated from a seed and proven winnable by a solver that also computes par. The toy already does this, in about 13 ms for 50 fields.
  - A random swiper wins only about 12% of fields, and takes about 2x par when it does. That shows the puzzles need thought.
- **v1 content in one line:** One 7x7 field, rocks, a pen, sheep and 1-2 wolves; generated fields with par 3-8 and a daily set.
- **Main risks:**
  - **Samey puzzles.** Generated puzzles can feel alike without a quality score.
  - **Too much planning.** Thinking four animals ahead may feel heavy for casual players.
  - **Familiar base.** Tilt and slide puzzles are a known family.
  - **Age rating.** The wolf rule must stay gentle.
- **Note on the toy:** Its builder added one extra: a red "Looks stuck — Undo?" hint that uses the solver to tell you when the field can no longer be won.

## 3. Why Line Siege beat Scrap Shove

The two tied at 39, so this is a judgment call.

- **Line Siege's twist changes every single decision.** The toy proves it: your first move fires a beam and pops a monster, and the preview shows which monster a column will hit before you commit.
- **Line Siege stands on the most familiar phone base there is**, block puzzles, and I found no game that aims line clears at enemies.
- **Scrap Shove is the safest to build.** But its toy showed the shove twist almost never matters, which would leave a 45-year-old game with a new look. That's weak for a fresh twist, and weak for store review's dislike of copycats.
- **Line Siege's main risk is balance**, which is exactly what Claude's bots can tune.

Flock Tilt is the pick if you prefer calm, short brain-teasers over a battle.

## 4. What to judge when trying each toy

Each takes about 2-3 minutes, so about 10 minutes for all three. Ignore how plain they look; art, sound and polish come later. The difficulty numbers are placeholders too.

- **Line Siege:**
  - Do you enjoy choosing which line to finish *because of where a monster is*?
  - Does the beam feel satisfying?
  - Is the screen readable at phone size (lanes plus board)?
- **Scrap Shove:**
  - Do the crashes make you feel clever?
  - Within a minute, do you ever deliberately shove scrap into a robot's path? If not, the twist is too weak.
- **Flock Tilt:**
  - On field 1, the obvious first tilt (left) traps you, and the best solution takes 4 tilts. Is finding it fun, or does it feel like homework?
  - Is the "don't let a sheep end up against the wolf" rule clear?

## 5. Your choice and hand-off note

**Choice (2026-09-26):** build all of the ideas from the research, one by one, each as its own separate app. Before the first game, build one reusable framework that every game plugs into. The research has 26 distinct ideas (32 candidates before merging duplicates), not 36.

**What the framework must include:**
- **Pages:** a home page, levels, statistics, settings and a purchase section.
- **Ads:** Google AdMob.
- **Purchase:** one purchase at about €1.90.
- **Languages:** English and German (left-to-right), Persian and Kurdish Sorani (right-to-left).
- **Offline:** no user accounts, no server, and nothing online of our own.
- **Platform:** React Native. That choice belongs to the platform step, not this one.

**Hand-off note for step 2 ("name it, spec it"):**
- **Spec:** the framework spec is `E07/spec.txt`. The pilot game that proves the framework defaults to Line Siege, the recommendation above. The other two finalists, Flock Tilt and Scrap Shove, are next in line.
- **Open questions the spec must settle** (listed at the end of `spec.txt`):
  - AdMob needs the internet while the app has no server. How this is resolved: our own code never goes online; only the ad and store systems do, and the game works fully offline.
  - What the purchase unlocks.
  - Whether to ask for iOS tracking permission.
  - The age rating.
  - The exact price point.
- **Risks to carry forward:**
  - Snare Snake and Merge Siege failed their toy tests, and Scrap Shove's twist rarely mattered. Each needs a design fix before it is built.
  - Several longlist ideas are near-copies of existing games (Last Stop, Dock Slide, Ripple Ten, Fuseban) and would face store copycat rejection unless reworked.
