# The game contract, per-game configuration and the next game

What a game must provide to become a complete app (spec 10), what its one configuration file holds (spec 11), and how the next game is made (spec 12). The last section maps these product terms to the names used in code.

## Contents

- 10 · The game contract (identity, rules, levels, board and controls, teaching, statistics, texts, testing)
- 11 · Per-game configuration
- 12 · Making the next game from the Shell
- Product terms and their code names

## 10 · The game contract

A game plugs into the Shell by providing exactly these things. Nothing else is needed to become a full app.

IDENTITY

- Game id (for example "line-siege"), and its name in 4 languages.
- Logo and app icon design (drawn in code).
- Palette: light and dark.
- Sound set (which sound for which event).

RULES

- Start state for a level (from its seed and difficulty).
- The list of moves allowed in a state.
- "Apply a move": returns the new state plus a list of events (what happened, for animations and sounds, for example "column 3 cleared, beam hit monster 2 for 8").
- "Is it over?": win, lose (with a reason), or still playing.
- Score and the goal/progress line for the top bar.
- Whether undo, hints and continue are supported, and how continue works.

LEVELS

- Level generator: seed + difficulty -> level.
- Solver or checker (where possible): proves a level can be won and calculates par.
- Pack layout: how many packs and levels, difficulty curve, star thresholds, pack names.
- Daily: which difficulty the daily uses.
- Endless: supported or not.

BOARD AND CONTROLS

- Draws the board from the state (shapes and colours, no image files).
- Turns taps / swipes / drags into moves.
- Animates the events (and respects Reduce motion).
- Declares whether the board mirrors in RTL (default: no).

TEACHING

- Scripted tutorial level (steps, pointer positions, one sentence each).
- 3-5 how-to-play steps with small drawn illustrations.

STATISTICS

- 2-4 game-specific counters with labels in 4 languages.

TEXTS

- Every string above in en, de, fa, ckb.

TESTING

- A simple bot that can play the game (for balance and winnability tests).
- Example states for automatic screenshots (start, middle, win, lose).

## 11 · Per-game configuration

One file per game holds:

- App name per language, store id / bundle id, version.
- Premium product id; price note (the price itself is set in the stores).
- AdMob app id and ad unit ids per platform (banner, interstitial, rewarded). Test ids in development.
- Ad rules: frequency numbers (spec 8.8), ads on/off master switch (spec 4.3).
- Modes on/off, packs and level counts, free hints per day, continue allowed.
- Privacy policy link and support email (for the stores and About).
- Age rating answers, target audience.

## 12 · Making the next game from the Shell

1. Start the new game inside the monorepo (the platform step replaced "copy the Shell": every game app consumes the same Shell package, so improvements made while building game N reach game N+1 automatically). `npm run new-game -- --app <game-id>` scaffolds `apps/<game-id>`.
2. Fill in the configuration file (spec 11).
3. Write the game module (spec 10): rules first, with tests and a bot; then board, controls, levels, tutorial, texts.
4. Run the automatic checks:
   - rules tests and bot balance runs;
   - solver check of every level;
   - the network audit;
   - the airplane-mode run;
   - screenshots in 4 languages x light/dark x phone/tablet.
5. The owner play-tests on the phone and reviews the screenshots.
6. Store pages and release (pipeline steps 8-9).

## Product terms and their code names

These names are fixed; use them exactly so searches find every use.

| Product term | Name in code |
|---|---|
| Game id | kebab-case, stable forever; also the app folder `apps/<game-id>`, the Expo slug, the commit scope and the prefix of the game's i18n keys (`line-siege.lose.broke-through`) |
| The game module (spec 10) | the `GameModule` type in `packages/game-kit/src/contract/`; the app's `apps/<game-id>/src/index.ts` exports it |
| Start state / moves / apply a move / is it over | engine functions `create`, `listMoves`, `applyMove`, `outcome`; input becomes a move through `intentToMove` |
| Animating events / drawing the board | `buildTimeline` and `draw` |
| Per-game configuration (spec 11) | `apps/<game-id>/game.config.ts`, composed by the Shell's `withShell` into `app.config.ts` |
| The Shell | `packages/shell` (`@e07/shell`, a placeholder scope until the framework is named, decision D6) |
| Pure game kit (contract types, seeded random numbers, geometry, timeline, solver and bot helpers) | `packages/game-kit` (no React, React Native, Expo or Skia imports) |
| Build and release scripts | `packages/tooling` |
| Game code folders | `apps/<game-id>/src/{rules,levels,board,tutorial,i18n}` and `src/index.ts`; catalogs `src/i18n/{en,de,fa,ckb}.json` |
| Bundle id | matches `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`, same on iOS and Android |
| Premium product id | `<bundle id>.premium` |
| Modes | `levels`, `daily`, `endless` |

What kind of engine a game needs:

- Turn-based games (about 24 of the 26): a pure `applyMove(state, move)` that returns the new state and events; the board animates the events.
- Resolution phases that play out over time (Bank Shot volleys, Toggle Drop, cascades): simulated inside `applyMove` with a fixed step, returning timestamped events ("simulate then replay").
- Continuous real-time play (Halo Drift): a fixed-step loop on the UI thread with inputs recorded for replay.
- The Shell must not assume a grid, and must support tap, swipe and drag input and games with or without levels (endless-only).
