// packages/shell/src/testing/tally-game.ts
// A complete, tiny ShellGameModule for game-host tests: count up by 1 or 2 to hit the target
// exactly; going past it loses. Undo unlimited, a solver hint, one continue, two counters,
// three levels (par 2, 3, 3), a daily and an endless mode. Taps: column 0 adds 1, column 1 adds 2
// (panMode 'none', no select regions); the board outlines a hinted move's column. The tutorial
// (reach 3) scripts add 1, then add 2. Its logo is one ink square; it ships no credits or music.
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import type { GameEngine, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';
import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

export type TallyState = { readonly count: number; readonly target: number };
export type TallyMove = { readonly kind: 'add'; readonly amount: 1 | 2 };
export type TallyEvent =
  | { readonly kind: 'count-added'; readonly amount: number }
  | { readonly kind: 'count-reset'; readonly to: number };
export type TallyTypes = {
  readonly state: TallyState;
  readonly move: TallyMove;
  readonly event: TallyEvent;
  readonly view: TallyState;
  readonly token: 'background';
  readonly sim: never;
};

const ADDED = 'count-added';
const ADD_ONE: TallyMove = { kind: 'add', amount: 1 };
const ADD_TWO: TallyMove = { kind: 'add', amount: 2 };

function outcome(state: TallyState): Outcome {
  if (state.count === state.target) return { kind: 'won', score: state.target * 10 };
  return state.count > state.target
    ? { kind: 'lost', reasonKey: 'tally.lose.overshot' }
    : { kind: 'playing' };
}

const ENGINE: GameEngine<TallyState, TallyMove, TallyEvent> = {
  create: (_seed, difficulty) => ({ count: 0, target: 3 + difficulty }),
  listMoves: (state) => (outcome(state).kind === 'playing' ? [ADD_ONE, ADD_TWO] : []),
  applyMove: (state, move) => ({
    state: { ...state, count: state.count + move.amount },
    events: [{ kind: ADDED, amount: move.amount }],
  }),
  outcome,
  panMode: 'none',
  selectRegions: [],
  intentToMove: (state, intent) => {
    if (intent.kind !== 'tap' || outcome(state).kind !== 'playing') return null;
    return intent.target.col === 0 ? ADD_ONE : ADD_TWO;
  },
  buildTimeline: () => [],
};

const RULES: GameRules<TallyState, TallyMove, TallyEvent> = {
  hud: (state) => ({
    score: state.count,
    goal: { id: 'tally.goal', values: { target: state.target } },
  }),
  undo: { kind: 'unlimited' },
  hints: {
    kind: 'solver',
    suggest: (state) => (state.target - state.count >= 2 ? ADD_TWO : ADD_ONE),
  },
  continueRun: {
    kind: 'once',
    descriptionId: 'tally.continue.step-back',
    apply: (lost) => ({
      state: { ...lost, count: lost.target - 1 },
      events: [{ kind: 'count-reset', to: lost.target - 1 }],
    }),
  },
};

const LEVELS: LevelsSpec<TallyState, TallyMove> = {
  difficultyFor: (level) => level,
  packs: [
    { id: 'first', nameId: 'tally.pack.first', firstLevel: 1, levelCount: 3, starsToUnlock: 0 },
  ],
  table: [1, 2, 3].map((level) => ({
    level,
    seed: level,
    difficulty: level,
    stars: { kind: 'par', par: Math.floor((4 + level) / 2) },
  })),
  solver: null,
  daily: { kind: 'daily', difficulty: 2, salt: 5 },
  endless: { kind: 'endless', difficulty: 7 },
};

const isRecord = (json: unknown): json is Readonly<Record<string, unknown>> =>
  typeof json === 'object' && json !== null;

export const TALLY_GAME: ShellGameModule<TallyTypes> = {
  identity: {
    id: 'tally',
    nameId: 'tally.name',
    winTitleId: 'tally.win-title',
    taglineId: 'tally.tagline',
  },
  engine: ENGINE,
  rules: RULES,
  levels: LEVELS,
  presentation: {
    board: {
      isMirroredInRtl: false,
      toView: (state) => state,
      layout: ({ width, height, isMirrored }) => ({ width, height, isMirrored, regions: [] }),
      draw: () => undefined,
      buildPaths: () => ({}),
      describe: (view) => ({ id: 'tally.board.summary', values: { count: view.count } }),
      targetsOfMove: (_state, move) => [{ regionId: 'board', col: move.amount - 1, row: 0 }],
    },
    art: {
      palettes: {
        light: { background: '#fff' },
        dark: { background: '#000' },
        colorBlindLight: { background: '#fff' },
        colorBlindDark: { background: '#000' },
      },
      logo: { layers: [{ role: 'k', d: 'M20 20H28V28H20Z' }] },
      credits: [],
    },
    sounds: {},
    palette: TEST_PALETTE,
  },
  realtime: null,
  teaching: {
    tutorial: {
      start: { count: 0, target: 3 },
      steps: [
        {
          messageId: 'tally.tutorial.add-one',
          pointer: { kind: 'target', target: { regionId: 'board', col: 0, row: 0 } },
          expect: { kind: 'move', move: ADD_ONE },
        },
        {
          messageId: 'tally.tutorial.add-two',
          pointer: { kind: 'target', target: { regionId: 'board', col: 1, row: 0 } },
          expect: { kind: 'move', move: ADD_TWO },
        },
      ],
    },
    howToPlay: [],
  },
  stats: {
    counters: [
      {
        id: 'adds',
        labelId: 'tally.stats.adds',
        aggregate: 'sum',
        measure: (events) => events.filter((event) => event.kind === ADDED).length,
      },
      {
        id: 'biggest-add',
        labelId: 'tally.stats.biggest',
        aggregate: 'max',
        measure: (events) =>
          Math.max(0, ...events.map((event) => (event.kind === ADDED ? event.amount : 0))),
      },
    ],
  },
  texts: { en: {}, de: {}, fa: {}, ckb: {} },
  testing: {
    bot: (_state, moves, rng) => ({ move: moves[0] ?? ADD_ONE, rng }),
    examples: {
      start: () => ENGINE.create(1, 0),
      middle: () => ({ count: 1, target: 3 }),
      win: () => ({ count: 3, target: 3 }),
      lose: () => ({ count: 4, target: 3 }),
    },
  },
  persistence: {
    stateVersion: 1,
    parseState: (json) =>
      isRecord(json) && typeof json['count'] === 'number' && typeof json['target'] === 'number'
        ? { count: json['count'], target: json['target'] }
        : null,
    parseMove: (json) =>
      isRecord(json) && json['kind'] === 'add' && (json['amount'] === 1 || json['amount'] === 2)
        ? { kind: 'add', amount: json['amount'] }
        : null,
    migrateState: () => null,
    savePolicy: { kind: 'after-every-move' },
  },
};
