# E07 idea hunt: research notes

Research done 2026-09-23 along four independent tracks: game-jam results, what small 2D games people play now (itch.io feeds and phone hits), small-team indie hits, and evidence about what AI coding agents build well. Anything I couldn't confirm is marked **(unconfirmed)**, with where I looked.

## What the research says (short version)

- **The winning shape is "a base everyone knows, plus one twist that changes decisions".** It holds for jam winners, itch.io's top web games and 2024-2026 phone hits alike: Balatro (poker), Dragonsweeper (mine-sweeping), RogueSlide (sliding), Ball x Pit (breakout), Nubby's Number Factory (peg-drop) and Is This Seat Taken? (seating logic). [itch roguelike feed](https://itch.io/games/top-rated/platform-web/tag-roguelike.xml), [Apple Design Awards](https://developer.apple.com/design/awards/), [Balatro mobile week 1](https://www.pocketgamer.biz/balatro-approaches-1-million-in-seven-days-on-mobile/)
- **Phones favour short, turn-based puzzle and card loops.** The median mobile session is 5-6 minutes. Board, card and puzzle games keep players longest, while arcade games lead on day 1 and then fade. [GameAnalytics benchmark summary](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks). Reviewers praise "completely offline" play and drag controls, and complain about misclicks on small screens. [Pocket Tactics](https://www.pockettactics.com/is-this-seat-taken/mobile-review)
- **Code-only art can carry a hit if it has one clear visual idea.** Mini Metro's founders ruled out "hand-built levels", "anything art-heavy" and "reliance on audio content" from the start. [Mini Metro postmortem](https://www.gamedeveloper.com/audio/postmortem-dinosaur-polo-club-s-i-mini-metro-i-). SNKRX sold 80k copies in 55 days with geometric art, though its developer admits the look needs polish. [SNKRX log](https://a327ex.com/posts/snkrx_log)
- **AI agents build the playable core of small 2D canvas games reliably, and fail silently on rules, balance, level design and input wiring.**
  - Anthropic's own 2D game-maker test "looked right" while nothing responded to input. [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)
  - Numeric balance and level design are agents' weakest areas. [GameXpert-Bench, Aug 2026](https://arxiv.org/html/2608.21833)
  - Checking state directly beats letting an agent "play" (92.2% vs 58.8%). [GameGen-verifier](https://arxiv.org/abs/2605.07442)
  - The best model found only 48% of bugs through exploratory play. [GBQA](https://arxiv.org/abs/2604.02648)
  - Conclusion: turn-based grid games with small, inspectable state are the most verifiable, and real-time physics, precision platforming and 3D are the least.
- **Touch controls are a real cost.** One team rebuilding arcade classics with Claude Code found touch "took as much iteration as core gameplay". [WotAI](https://wotai.co/blog/wotai-games-vibe-coded-arcade-classics). Taps and swipes are safer than virtual sticks.
- **Claude Code does build its own test bots and simulations when the design allows it.**
  - An Aug 2026 head-to-head of three agents building the same game had Claude Code write headless simulations and Playwright tests. [XDA](https://www.xda-developers.com/asked-claude-code-codex-and-antigravity-to-build-the-same-game/)
  - A js13k 2026 author used Claude Code for "the implementation... and the bot I balanced against". [Empire of Sugar](https://js13kgames.com/2026/games/empire-of-sugar)
  - The same XDA test found Claude Code over-delivers scope (8 weapons when 3 were asked), so v1 content needs a cap.

## Longlist (26 ideas; merged duplicates noted)

Every idea below passed the hard filters: 2D, single-player, offline, code-made art and sound, nothing to install, original presentation possible.

| # | Working title | One line |
|---|---|---|
| 1 | **Scrap Shove** | The old robot-chase game (robots step toward you and wreck themselves on collisions), but you can shove the scrap heaps like crates. |
| 2 | **Snare Snake** | Turn-based Snake where crossing your own body closes a loop, captures critters inside, and spends those segments. *Merged: Loop Lasso, Lasso.* |
| 3 | **Line Siege** | Block-placement line clears where every cleared column fires up its lane at marching monsters. *Merged: Siegeblock (telegraphed boss zone), Rot Block (spreading rot).* |
| 4 | **Merge Siege** | 2048-style swipe merging while numbered enemies march in; bigger tiles smash smaller enemies. |
| 5 | **Flock Tilt** | Swipe to tilt the pasture: every sheep and wolf slides until blocked; pen the flock without feeding the wolves. *Merged: Slide & Stop, Whistle Flock.* |
| 6 | Letter Bugs | Swipe-to-spell letter grid where bugs crawl under the letters; spell through them to squash them. |
| 7 | Jump Chain | Solo checkers: one piece against advancing enemy ranks; only multi-jump chains clear them. |
| 8 | Swap Guard | Telegraphed-attack tactics where your only move is swapping places, so enemies hit each other. |
| 9 | Stepstone | Small-grid tactics where the tile you stand on decides how you move next (knight, rook, bishop). |
| 10 | Fuseban | Sokoban solved by placing timed charges whose blasts shove the crates. |
| 11 | Grove Shift | Wrap-around sliding grid where every tile you move ages a step. |
| 12 | Exact Zero | Card duel on one shared countdown number; land it exactly on zero. |
| 13 | Toggle Drop | Peg-board ball drop where every peg is a flip-flop switch. |
| 14 | Poker Drop | Drop cards into a 5-column well; poker hands in any line burst and cascade. |
| 15 | Ripple Ten | Box numbers that sum to ten; every neighbour of the cleared box goes up by one. |
| 16 | Dig Site | Number deduction hunting fossil skeletons of known shapes on a stroke budget. |
| 17 | Floodline | Number deduction where flags are sandbags against a spreading flood. |
| 18 | Sonar Hand | Deduction with a hand of probe shapes that each count what's inside their footprint. |
| 19 | Deep Sweep | Mine deduction as a descent; the ceiling collapses every few reveals. |
| 20 | Trail Clear | Edge-matching tiles on a 5x5 board; closing a road or river loop scores it and wipes those tiles. |
| 21 | Dock Slide | Slide-merge puzzle where edge docks post timed orders you ship tiles out to fill. |
| 22 | Dice Foundry | Place rolled dice on a 3x3 grid of machines that combo by adjacency, against rising rent. |
| 23 | Rank Ladder | Golf solitaire as a short run, editing your deck between deals. |
| 24 | Last Stop | Seat ferry passengers by their wishes as they board stop by stop. |
| 25 | Bank Shot | Ball volleys where each wall bounce before a hit doubles damage. |
| 26 | Halo Drift | One-thumb survivors-like where the ring orbiting you is your only weapon. |

## Why each dropped idea went

Screened on criteria 1-2 (fun and clarity; Claude can verify it) and the high-risk list:

- **Letter Bugs**: the strongest fun signal of any jam inspiration: [My Keyboard is Full of Ants!](https://ldjam.com/events/ludum-dare/56/my-keyboard-is-full-of-ants) was #1 overall and #2 for fun in the LD56 compo. It still came 6th, because a word game is English-only for a store launch and needs dictionary curation, including filtering offensive words. The ENABLE word list is public domain ([readme](http://wiki.puzzlers.org/dokuwiki/doku.php?id=solving:wordlists:about:enable_readme)).
- **Jump Chain**: the board-game roguelike space is crowded. Its precedent, [Tiny Checkers](https://thiori.itch.io/tinycheckers/devlog/822815/tiny-checker-got-3rd-in-ludumdare56), is close, and its exact rules are **(unconfirmed)**: the itch page returned 403, and only the LD API description was readable.
- **Swap Guard**: too many interacting systems (enemy types, resolution order) for a first version. It also overlaps Scrap Shove.
- **Stepstone**: 6-8 move glyphs are hard to read on a phone, and chess roguelites are crowded ([Gambonanza review](https://www.pocketgamer.com/gambonanza/review/)).
- **Fuseban**: nearly the same mechanic as [Research & Detonation](https://itch.io/jam/gmtk-jam-2026/rate/4829586) (GMTK 2026), and it's a pure level puzzle.
- **Grove Shift**: the goal is abstract, so it fails "understood in 30 seconds".
- **Exact Zero**: needs a card pool (a content-volume risk), sits close to [NULL RUSH!](https://tulsonic.itch.io/null-rush-gmtk-2026), and is maths-niche.
- **Toggle Drop**: risks reading as a cold bookkeeping puzzle rather than the chaotic fun of peg games.
- **Poker Drop**: clear-rate tuning risk. Whether card imagery triggers a "simulated gambling" age rating is **(unconfirmed)**; this wasn't researched.
- **Ripple Ten**: very close to [Make Ten](https://pancelor.itch.io/make-ten). Whether Make Ten Deluxe's 35+ variants already include this rule is **(unconfirmed)**; the page returned 403. Narrow maths audience.
- **Dig Site, Floodline, Sonar Hand, Deep Sweep**: mine-deduction is crowded on itch (Dragonsweeper, Minato, Dynamine, Gem Jam). Players punish boards that feel unsolvable, and flag-marking is awkward on touch ([Dragonsweeper HN thread](https://news.ycombinator.com/item?id=42812157)). I kept none rather than four similar ones.
- **Trail Clear**: edge matching on a 5x5 board risks dead positions, and "what gets wiped" is hard to read before you commit.
- **Dock Slide**: Threes' designers tried and dropped a similar "cash-out" idea ([Threemails](https://asherv.com/threes/threemails/)), and 2048 clones flood the stores ([TechCrunch](https://techcrunch.com/2014/03/24/clones-clones-everywhere-1024-2048-and-other-copies-of-popular-paid-game-threes-fill-the-app-stores)).
- **Dice Foundry**: engine-builders live on item count (Ballionaire has 125+ triggers, Slice & Dice 473 items), which is the high-risk content-volume kind. Balatro-likes are crowded.
- **Rank Ladder**: a crowded card-roguelike space, and deck-edit types still need balancing.
- **Last Stop**: too close to [Is This Seat Taken?](https://developer.apple.com/design/awards/) (2026 Apple Design Award), so it would read as a copycat.
- **Bank Shot**: physics feel, a high-risk kind, and Ballz clones are plentiful.
- **Halo Drift**: a real-time, feel-heavy survivors-like. Claude can only half-verify it (criterion 2 ≈ 3), and upgrade content creeps.

Dropped by the tracks before the longlist:
- online, multiplayer or streaming jam gimmicks (fail offline or single-player)
- 3D/WebXR entries
- visual novels (story-heavy)
- fan games (trademarks)
- rhythm games
- tower defense with tile drafting (it's [Isle of Arrows](https://gridpop.co/isle/))
- a solitaire dungeon crawler (it's Card Crawl 2)
- Suika-style physics merge
- idle and incremental games (long sessions, few early decisions)

## Finalists and the reasons behind their scores

Scores are 1-5; criteria 1 and 2 count double; the maximum is 45.

**Scrap Shove: 40.**
- Fun 4: "they chase you, make them crash" explains itself, and every turn is a small readable puzzle.
- Verify 5: a pure step function, deterministic robots, and floors a search can prove winnable.
- Art 5: glyphs and chevrons are exactly what code draws well.
- Replay 4: procedural floors, though it needs 2-3 robot variants.
- Scope 5: grid, robots and heaps only.
- Twist 3, lowered after a spot-check. The base is [Chase](https://en.wikipedia.org/wiki/Chase_(video_game)) / [robots(6)](https://man.freebsd.org/cgi/man.cgi?query=robots), and [Push Dungeon](https://portfolio.anima.pink/posts/pushdg/) already mixes pushing with baiting enemies. I found no game where you shove wreckage into robots, but that is **(unconfirmed)** beyond a web search.
- Controls 5: tap an adjacent square, the best phone input.

**Snare Snake: 39.**
- Fun 4: everyone knows Snake, and "crossing yourself captures" reverses a rule people have known for years.
- Verify 5: a tick function, flood-fill capture with unit tests, and seeded critters.
- Art 5: neon lines and flood-fill flashes.
- Replay 4: score attack or a daily seed.
- Scope 5.
- Twist 3, lowered after a spot-check. Loop-capture snakes exist as jam games ([Portaloop](https://gethis.itch.io/portaloop), [Loop Snake](https://abluehuman.itch.io/loop-snake)), and [UniRush](https://js13kgames.com/2026/games/unirush) has telegraphed snake enemies. The turn-based, spend-your-length version is the fresh part.
- Controls 4: 4-way swipes on a phone need care.

**Line Siege: 39.**
- Fun 4: the block-placement base is mass-familiar (Block Blast's reported ~216M installs in 2024 are **(unconfirmed)**; secondary sources only), and aiming clears is readable. It lost a point because two play areas (lanes and board) must fit on a phone screen.
- Verify 5: pure functions over an 8x8 array, and greedy bots can play thousands of runs.
- Art 5.
- Replay 5: endless seeded runs.
- Scope 4.
- Twist 3: I found no game that fires line clears up lanes ([search](https://play.google.com/store/apps/details?id=com.gamincat.blockshooter&hl=en)), but block-puzzle RPG hybrids probably exist **(unconfirmed)**, and [Bees Save Themselves](https://ldjam.com/events/ludum-dare/56/bees-save-themselves) is a close jam relative.
- Controls 4: one drag or tap input; touch drag needs a finger offset.

**Merge Siege: 38.**
- Fun 4 and Verify 5.
- Twist 2: 2048 variants are saturated, and store review may see "another 2048".
- Kept as the fourth finalist, without a toy.

**Flock Tilt: 37.**
- Verify 5: BFS proves every puzzle solvable and gives par.
- Replay 3: generated slide puzzles risk feeling samey.
- Twist 3: tilt and slide puzzles exist, and [RogueSlide](https://www.pocketgamer.com/rogueslide/review/) is already on phones.
- Controls 5.
- Kept as the fifth finalist.

## What the toys changed

Each toy passed the automated check. The check loads the file from disk in Chrome, finds no console errors and no network requests, and confirms that scripted mouse and touch input changes the game state compared with the same wait without input. The builders also ran simple bots against each toy's rules. Per the kill rule, what the toys revealed counts in the ranking:

- **Scrap Shove: 40 → 39.** The toy is fun within seconds: robots crash within 2-3 taps and each floor takes a few turns. But the twist barely shows up. Over 300 simulated games a one-move-lookahead bot got about 0.25 chances per game to crush a robot with scrap, and almost all its wins came from classic robot-on-robot crashes. Twist 3 → 2.
- **Snare Snake: 39 → 37, dropped (kill rule).** Closing a loop reads instantly, but catching anything doesn't happen within seconds. On a grid, enclosing even one cell takes an 8-segment ring, so the starting snake (length 5) can't catch anything. Critters also slip out while the loop is being drawn. A search that could see every future critter move found no catch within 13 moves from the start, and a greedy bot caught 1 critter in 20,000 moves. This is a structural friction in the idea, not a tuning number. Fun 4 → 3.
- **Line Siege: stays 39.** The first move fires a beam and pops a monster. Before you commit, the ghost preview and lane highlight show which monster a column will hit. As specced, the pace was near-unwinnable (a bot lost all 200 games within about 6 placements). I eased two pacing numbers (monsters march every 2nd placement and spawn every 3rd), which roughly doubles survival in the builder's simulation. Balance still needs real design work; bots can do that tuning.
- **Merge Siege: 38 → 36, dropped.** Feedback is instant (merge pop, smash burst), but the decision is murky: all your tiles move at once, so most clashes become one-for-one trades ("Smashed 1 · Lost a tile!"). Every simulated run ended "Overrun" in about 15-20 moves. Fun 4 → 3. Its toy is kept in `toys/merge-siege.html`.
- **Flock Tilt (37)** moved into the top three, so it got a toy too (next section of the shortlist).

## Useful access notes (checked 2026-09-23)

- **itch.io:** the feeds work (`/games/top-rated/platform-web.xml`, plus genre and tag variants). The "most-popular" feed form returns empty; use `/games/platform-web.xml` instead.
- **Ludum Dare:** the API recipe from the brief worked for LD55-59.
- **js13kGames:** its per-game JSON (`js13kgames.com/g/<slug>`) carries category ranks for 2024-2025. The 2026 results were not published yet.
- **GMTK:** results pages return 403, so Mark Brown's top-20 posts stood in ([2025](https://gmtk.substack.com/p/my-favourite-games-from-gmtk-game), [2026](https://gmtk.substack.com/p/my-favourite-games-from-gmtk-game-50b)).

## Sources (what each contributed)

**Jam results**
- [Ludum Dare API](https://api.ldjam.com/vx/node/walk/1/events/ludum-dare/59): LD55-59 per-category ranks (Overall, Fun, Innovation) for 254 games.
- [My Keyboard is Full of Ants!](https://ldjam.com/events/ludum-dare/56/my-keyboard-is-full-of-ants): a word game with moving targets won LD56 compo overall.
- [Bees Save Themselves](https://ldjam.com/events/ludum-dare/56/bees-save-themselves): block placement against a telegraphed attack zone (LD56 jam, #9 Fun).
- [Good Boy](https://ldjam.com/events/ludum-dare/59/good-boy): indirect 4-command herding works with touch.
- js13k:
  - [UniRush](https://js13kgames.com/2026/games/unirush): telegraphed deterministic enemies; made with Claude.
  - [Rainbow Reins](https://js13kgames.com/2026/games/rainbow-reins): levels generated backwards from a solution, with exhaustive-search par.
  - [Ghosted](https://js13kgames.com/2024/games/ghosted): a budget twist on Sokoban placed #3 overall.
- [Frank Force: 4 js13k games with Claude Code](https://frankforce.com/i-made-4-games-for-js13k-2026/): about one week per game when reusing an engine.
- Mark Brown's GMTK picks: [2024](https://gmtk.substack.com/p/the-best-games-from-gmtk-game-jam-500), [2025](https://gmtk.substack.com/p/my-favourite-games-from-gmtk-game), [2026](https://gmtk.substack.com/p/my-favourite-games-from-gmtk-game-50b). Current jam taste favours crisp deterministic rule twists.

**Phones and itch.io**
- itch.io feeds ([top-rated web](https://itch.io/games/top-rated/platform-web.xml), [puzzle](https://itch.io/games/top-rated/genre-puzzle/platform-web.xml), [roguelike](https://itch.io/games/top-rated/platform-web/tag-roguelike.xml), [card](https://itch.io/games/top-rated/platform-web/tag-card-game.xml), [turn-based](https://itch.io/games/top-rated/platform-web/tag-turn-based.xml)): what is played and rated now.
- [Apple Design Awards 2026](https://developer.apple.com/design/awards/): Is This Seat Taken? won Delight and Fun; Ball x Pit was a finalist.
- [Balatro mobile revenue](https://www.shacknews.com/article/142371/balatro-mobile-4-million) and [Nubby's mobile launch](https://www.notebookcheck.net/Nubby-s-Number-Factory-is-now-on-iPhone-and-Android.1276400.0.html): premium, offline, no-ads games sell on phones.
- [Card Crawl 2 first month](http://www.arnoldrauers.com/first-month-of-card-crawl-2/): a realistic scale for a small mobile game, the backlash from aggressive monetisation, and Claude Code used for an economy model.
- [Pocket Gamer best mobile games of 2026](https://www.pocketgamer.com/best-games/mobile-games-of-2026/): roguelite-twist puzzle and card games lead.

**Indie design lessons**
- [Threemails](https://asherv.com/threes/threemails/): a script could beat 2048, so "naive bots should lose" is a design test.
- [Dorfromantik](https://www.gamedeveloper.com/business/sparking-joy-through-tile-placement-in-idyllic-village-builder-i-dorfromantik-i-): make the most-repeated action as satisfying as possible.
- [Michael Brough on small grids](https://www.gamedeveloper.com/design/freedom-through-constraints-the-design-of-michael-brough-s-i-imbroglio-i-): small boards make elements interact more.
- [Luck be a Landlord design Q&A](https://blog.trampolinetales.com/questions-and-danswers/): fairness safety valves.
- [Nubby's Number Factory](https://gamemaker.io/en/blog/following-the-fun-nubbys-number-factory): grab attention in the first half second.
- [Mini Motorways audio postmortem](https://disasterpeace.com/blog/mini-motorways.postmortem): game-driven procedural sound.

**AI-built games**
- [OpenGame-Bench](https://arxiv.org/html/2604.18394v1): genre scores judged from screenshots; logic failures are silent.
- [WebGameBench](https://arxiv.org/html/2605.17637): typical agent bugs are illegal moves accepted, missed phase transitions and lost persistence.
- [LittleJS Arcade AGENTS.md](https://github.com/KilledByAPixel/LittleJSArcade/blob/main/AGENTS.md): classic 2D bases are easy for agents; lists common pitfalls.
- [Carom (Show HN)](https://news.ycombinator.com/item?id=47656249): a Claude Code-built daily slide puzzle.
- [claude-minigames](https://github.com/aaomidi/claude-minigames): vector-only art, procedural audio and solver bots, built by Claude Code.
- [Vibe Jam 2025 winners](https://levels.io/winners-of-the-2025-vibe-code-game-jam): even winners were marked down for jank and controls.

**Spot-checks for originality**
- [Chase (1976)](https://en.wikipedia.org/wiki/Chase_(video_game))
- [Push Dungeon](https://portfolio.anima.pink/posts/pushdg/)
- [Portaloop](https://gethis.itch.io/portaloop)
- [Loop Snake](https://abluehuman.itch.io/loop-snake)

## Couldn't confirm

- GMTK community-voted ranks: itch results pages return 403.
- js13k 2026 final results: not published yet.
- Whether any shipped commercial game already uses the exact twists of the top three. I searched the web, not the App Store or Google Play.
- Whether "Minesweeper" or "Plinko" are trademarks to avoid: not researched; I avoided the names as a precaution.
