# Assembling a game module

How one game becomes a `ShellGameModule`: the types bag, `src/index.ts`, the teaching script, the contract test, the save policy, the catalog keys and the 3-line entry. Read it when a game's parts exist and it is time to assemble them (step 4 of the workflow), and when `check-game-host.mjs` reports an assembly rule.

## Contents

- When to assemble
- Where each member comes from
- The types bag
- src/index.ts
- The teaching script
- The contract test
- The save policy
- game.config.ts must match the rules
- Catalog keys the module hands over
- The 3-line entry
- Order of commands
- Testing the host itself: the tally game

## When to assemble

Assembly is the last code step of a game, after its rules and bot, levels, persistence, board and input, palette, art and sounds exist, each with its own tests. The scaffold's `apps/<game-id>/index.ts` is a placeholder until then: switching to the 3-line entry before `src/index.ts` exists breaks the type check of the whole app.

## Where each member comes from

| Member | Value | File | Built with |
|---|---|---|---|
| `identity` | `{ id: '<game-id>', nameId: '<game-id>.name', winTitleId: '<game-id>.win-title', taglineId: '<game-id>.tagline' }` | `src/index.ts` | this skill |
| `engine` | `<GAME_CONST>_ENGINE` (with `panMode`) | `src/rules/<game-id>-engine.ts` | game-rules-engine (`intentToMove` and the pan mode from board-gestures-and-input, `buildTimeline` from board-rendering-skia) |
| `rules` | `<GAME_CONST>_RULES` (hud, undo, hints, continueRun) | `src/rules/<game-id>-engine.ts` | game-rules-engine |
| `levels` | `<GAME_CONST>_LEVELS` | `src/levels/<game-id>-levels.ts` | level-generation-and-solvers |
| `presentation.board` | `<gameCamel>Board` | `src/board/<game-id>-board.ts` | board-rendering-skia |
| `presentation.art` | `GAME_ART` (below) | `src/art/game-art.ts` | code-drawn-art-and-icons (palettes, `LOGO_ART`, credits) |
| `presentation.sounds` | `SOUND_BANK` | `src/sounds/sound-bank.ts` | game-audio-and-haptics |
| `presentation.palette` | `PALETTE` | `src/theme/palette.ts` | toybox-design-system |
| `realtime` | `null` (turn-based) or the real-time spec | `src/sim/` | realtime-game-loop |
| `teaching` | `<GAME_CONST>_TEACHING` | `src/tutorial/<game-id>-teaching.ts` | this skill |
| `stats` | `<GAME_CONST>_STATS` | `src/rules/<game-id>-stats.ts` | game-rules-engine |
| `texts` | `{ en, de, fa, ckb }` | `src/i18n/*.json` | i18n-strings-and-catalogs |
| `testing` | `<GAME_CONST>_TESTING` (bot and four example states) | `src/testing/<game-id>-testing.ts` | game-rules-engine |
| `persistence` | `<GAME_CONST>_PERSISTENCE` | `src/rules/<game-id>-persistence.ts` | game-rules-engine |

Placeholders in this skill's templates: `__GAME_ID__` (kebab-case id, also in file names), `__GAME_PASCAL__` (`LineSiege`), `__GAME_CAMEL__` (`lineSiege`), `__GAME_CONST__` (`LINE_SIEGE`).

## The types bag

`apps/<game-id>/src/<game-id>-types.ts` names the game's types once for the Shell:

```ts
export type LineSiegeTypes = {
  readonly state: LineSiegeState;   // rules/<game-id>-types.ts
  readonly move: LineSiegeMove;
  readonly event: LineSiegeEvent;
  readonly view: LineSiegeView;     // board/to-view.ts
  readonly token: BoardToken;       // board/board-palettes.ts
  readonly sim: never;              // turn-based; a real-time game names its typed-array sim
};
```

All six keys are required (`types-bag`). The bag is imported with `import type` only; nothing else in the Shell ever sees it.

## src/index.ts

Assembly only: imports, then ONE typed constant. No logic, no helper functions, no conditions (`module-assembly`):

```ts
export const lineSiegeGame: ShellGameModule<LineSiegeTypes> = {
  identity: {
    id: 'line-siege',
    nameId: 'line-siege.name',
    winTitleId: 'line-siege.win-title',
    taglineId: 'line-siege.tagline',
  },
  engine: LINE_SIEGE_ENGINE,
  rules: LINE_SIEGE_RULES,
  levels: LINE_SIEGE_LEVELS,
  presentation: { board: lineSiegeBoard, art: GAME_ART, sounds: SOUND_BANK, palette: PALETTE },
  realtime: null,
  teaching: LINE_SIEGE_TEACHING,
  stats: LINE_SIEGE_STATS,
  texts: { en, de, fa, ckb },
  testing: LINE_SIEGE_TESTING,
  persistence: LINE_SIEGE_PERSISTENCE,
};
```

`identity.id` is the folder name, the package `@e07/<game-id>`, `game.config.ts` `id` and the save document's `gameId`; it never changes after release (a changed id orphans every player's save).

`presentation.art` is the game's `GAME_ART`, which the code-drawn-art-and-icons skill writes from its template (`apps/<game-id>/src/art/game-art.ts`): the board's four palettes, `logo: LOGO_ART` (the same data the app icon and splash are rendered from) and the game's own licence credits, typed as a literal (no cast):

```ts
export const GAME_ART: GameArt<BoardToken> = {
  palettes: BOARD_PALETTES,
  logo: LOGO_ART,
  credits: CREDITS, // [] for most games: the fonts are the Shell's rows and every sound is generated
};
```

The host hands `logo` and `credits` to screens (`host.logo`, `host.credits`), `identity.winTitleId` becomes the S7 heading and `identity.taglineId` the line under the name on S1, S4 and S11b, so the catalogs need `<game-id>.win-title` and `<game-id>.tagline` in all four languages (the copy deck has it for the designed games: "The wall holds!", "All sheep home!", "All robots scrapped!").

## The teaching script

`src/tutorial/<game-id>-teaching.ts` exports `<GAME_CONST>_TEACHING: TeachingSpec<State, Move>` (spec S13):

- `tutorial.start`: a hand-made start state (the host's tutorial run begins here instead of `create`).
- `tutorial.steps`: one short sentence (`messageId`), one pointer, one expected action per step. Pointers: `{ kind: 'target', target }` (a board cell), `{ kind: 'drag', from, to }`, `{ kind: 'hud', element: 'undo' | 'hint' | 'pause' }` (a Shell top-bar button) or `{ kind: 'none' }`. Expected actions: `{ kind: 'move', move }` or `{ kind: 'any-move' }`. Skip appears from the second step.
- `howToPlay`: 3 to 5 pages, each a title, a body and an `example` state drawn by the game's own board (pure data, so the page renders anywhere, including goldens).

Rules the checker runs headless against the game's own `listMoves` and `applyMove` (`teaching`, `teaching-keys`): 3 to 5 pages; every `expect.move` is legal at its step when the steps are applied in order from `tutorial.start`; every `messageId`, `titleId` and `bodyId` is in all four catalogs. The template's test also proves the scripted moves win the tutorial and that every page example is still playing. Build the example states with the rules' own functions (`applyMove(PLUS, TAP_CORNER).state`), never by hand-editing arrays that could drift from the rules.

The template is Tap Flip's (a 3 × 3 lights-out board); keep its structure, replace its states and moves. For a game that draws its future from the RNG (Line Siege), take `tutorial.start` from `create(seed, 0)` of a seed whose opening suits the first step (seed 1 leaves column 7 two cells short, so step 1 can drag the vertical two from tray slot 1 into it and fire a beam), script only the first steps with `{ kind: 'move', move }` and let the rest be `{ kind: 'any-move' }`.

The Shell plays the script on the Tutorial route (host-architecture.md, "The Tutorial route"): each step accepts only its expected move, so every scripted move must be one a player can make with the game's controls at that step.

## The contract test

`src/contract.test.ts` runs the module-wide checks of spec section 10 next to the game's own tests (`contract-test` requires `engineContractProblems` and `levelsContractProblems`):

| Case | Asserts |
|---|---|
| identity and catalogs | `identity` is `{ id, nameId: '<id>.name', winTitleId: '<id>.win-title', taglineId: '<id>.tagline' }`; every key the module hands over (name, win title, hud goal, pack names, tutorial and how-to-play texts, counter labels, continue description, lose reason) is in all four catalogs |
| art | the logo has layers; every credit has a name, version and licence |
| catalog shape | the four catalogs have identical keys, all starting with `<game-id>.` |
| engine | `engineContractProblems` on the first level of every pack and a daily-like start: determinism, legality, a valid `panMode`, JSON round trips, the end-state rules |
| levels | `levelsContractProblems`: the table covers the packs, levels numbered 1..n, packs match `game.config.ts` `levels`, every level solvable at its par |
| teaching and counters | 3 to 5 pages; 2 to 4 unique kebab-case counter ids |
| examples | `start` and `middle` play, `win` is won, `lose` is lost, all JSON-safe |
| save policy | turn-based: `realtime` is `null` and `savePolicy` is `after-every-move` |

`LEVEL_CONFIG` in the test must equal `game.config.ts` `levels`. The engine case passes `intents: () => []` because the game's engine test (`<game-id>-engine.test.ts`, game-rules-engine) already runs the contract with the game's real intents.

## The save policy

Turn-based games (`realtime: null`) must use `savePolicy: { kind: 'after-every-move' }`; a real-time game must use `{ kind: 'save-points', points }` and declare the same points in `realtime.savePoints` (`save-policy`). The policy decides whether the run writer saves after each move or leaves saving to the real-time host's save points.

## game.config.ts must match the rules

The new-game scaffold writes `apps/<game-id>/game.config.ts`; two of its values describe what the rules can do, and `check-game-host.mjs` cross-checks them (`config-rules`):

| `game.config.ts` | Must be | Why |
|---|---|---|
| `isContinueAllowed` | `true` exactly when `rules.continueRun` is `{ kind: 'once', ... }` | a Continue the rules cannot apply is a button that does nothing; a continue rule the config switches off is dead code the owner thinks is live |
| `hints.freePerDay` | `0` when `rules.hints` is `{ kind: 'none' }` | a free hint needs a solver to suggest a move (Line Siege draws its future from the RNG, so it has none) |

Line Siege: `continueRun: { kind: 'once', descriptionId: 'line-siege.continue.push-back', apply }`, `hints: { kind: 'none' }`, so `isContinueAllowed: true` and `hints: { freePerDay: 0 }`.

## Catalog keys the module hands over

Every string the Shell shows for the game is a key in the game's four catalogs (`apps/<game-id>/src/i18n/{en,de,fa,ckb}.json`, flat, sorted, identical keys). `examples/tap-flip/i18n/` holds a complete set for the template game: name, win title, goal, hud line, lose reason, continue description, pack names, counter labels, board summary, tutorial and how-to-play texts. Plurals use ICU (`{lit, plural, one {# cell lit} other {# cells lit}}`); numbers use `{moves, number}` so the Shell's digit choice applies.

## The 3-line entry

`apps/<game-id>/index.ts` is exactly (`entry`):

```ts
// apps/line-siege/index.ts
import { startShell } from '@e07/shell/app/start-shell.ts';

import { lineSiegeGame } from './src/index.ts';
startShell(lineSiegeGame);
```

The blank line between the two imports is required by `import/order`. `startShell` runs the Intl polyfills first, the direction check second, then the composition root. The app never imports `game.config.ts` at runtime.

## Order of commands

1. Copy `templates/apps/__GAME_ID__/` into `apps/<game-id>/`, renaming files and replacing the placeholders; copy the catalogs' teaching keys into all four catalogs.
2. Write the teaching test first (it fails), then the teaching script until it passes.
3. `npx eslint --fix apps/<game-id>` and `npx prettier --write apps/<game-id>/src apps/<game-id>/index.ts` (import order depends on the game id).
4. `npx tsc --noEmit -p apps/<game-id>`; `npx jest apps/<game-id>/src/contract.test.ts apps/<game-id>/src/tutorial --ci --selectProjects unit --coverage --collectCoverageFrom='apps/<game-id>/src/tutorial/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds).
5. `node ${CLAUDE_SKILL_DIR}/scripts/check-game-host.mjs . --game <game-id>` until `RESULT: PASS`.

## Testing the host itself: the tally game

`packages/shell/src/testing/tally-game.ts` is a complete, tiny `ShellGameModule` used only by the host's own tests: count up by 1 or 2 to hit a target exactly, going past it loses; unlimited undo, a solver hint, one continue, two counters, three par-rated levels, a daily and an endless mode; taps on column 0 add 1, column 1 adds 2. Every host behaviour is proven against it, so host tests never depend on a real game. When the host grows (a new command, a new view field), extend the tally game and its tests first.
