// packages/game-kit/src/testing/engine-contract.test.ts
import { engineContractProblems } from './engine-contract.ts';

import type { EngineContractInput } from './engine-contract.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** Toy game: tap a column to add 1 to it; three columns full (value 2) wins, 9 taps lose. */
type Tally = { readonly cols: readonly number[]; readonly taps: number };
type Tap = { readonly kind: 'add'; readonly col: number };
type Added = { readonly kind: 'column-added'; readonly col: number };

const isTap = (json: unknown): json is Tap =>
  typeof json === 'object' && json !== null && Reflect.get(json, 'kind') === 'add';

const ENGINE: EngineContractInput<Tally, Tap, Added>['engine'] = {
  create: (seed) => ({ cols: [seed % 2, 0, 0], taps: 0 }),
  listMoves: (state) =>
    state.cols.every((value) => value >= 2) || state.taps >= 9
      ? []
      : state.cols.flatMap((value, col) => (value < 2 ? [{ kind: 'add', col } as const] : [])),
  applyMove: (state, move) => ({
    state: {
      cols: state.cols.map((value, col) => (col === move.col ? value + 1 : value)),
      taps: state.taps + 1,
    },
    events: [{ kind: 'column-added', col: move.col }],
  }),
  outcome: (state) => {
    if (state.cols.every((value) => value >= 2)) return { kind: 'won', score: 9 - state.taps };
    return state.taps >= 9
      ? { kind: 'lost', reasonKey: 'tally.lose.out-of-taps' }
      : { kind: 'playing' };
  },
  panMode: 'none',
  selectRegions: [],
  intentToMove: (state, intent) =>
    intent.kind === 'tap' && (state.cols[intent.target.col] ?? 2) < 2
      ? { kind: 'add', col: intent.target.col }
      : null,
};

const TAPS = [0, 1, 2].map((col): InputIntent => ({
  kind: 'tap',
  target: { regionId: 'board', col, row: 0 },
  selected: null,
}));
/** A picker strip whose taps select; a board tap then adds to the selected column. */
const PICKS = [0, 1, 2].map((col): InputIntent => ({
  kind: 'tap',
  target: { regionId: 'picker', col, row: 0 },
  selected: null,
}));
const PICKING: typeof ENGINE = {
  ...ENGINE,
  selectRegions: ['picker'],
  intentToMove: (state, intent) =>
    intent.kind === 'tap' && intent.selected !== null && intent.target.regionId === 'board'
      ? ENGINE.intentToMove(state, { ...intent, target: intent.selected })
      : null,
};

function inputWith(
  engine: EngineContractInput<Tally, Tap, Added>['engine'],
): EngineContractInput<Tally, Tap, Added> {
  return {
    gameId: 'tally',
    engine,
    persistence: {
      parseState: (json) => (typeof json === 'object' && json !== null ? (json as Tally) : null),
      parseMove: (json) => (isTap(json) ? json : null),
    },
    starts: [1, 2, 3].map((seed) => ({ seed, difficulty: 0 })),
    maxMoves: 20,
    intents: () => TAPS,
  };
}

describe('engineContractProblems', () => {
  it('finds nothing wrong with a pure, deterministic engine', () => {
    expect(engineContractProblems(inputWith(ENGINE))).toStrictEqual([]);
  });

  it('reports an applyMove that changes its input', () => {
    const mutating: typeof ENGINE = {
      ...ENGINE,
      applyMove: (state, move) => {
        const result = ENGINE.applyMove(state, move);
        Reflect.set(state, 'taps', state.taps + 100);
        return result;
      },
    };
    expect(engineContractProblems(inputWith(mutating))[0]).toContain('changed its input state');
  });

  it('reports state that JSON cannot carry', () => {
    const lossy: typeof ENGINE = {
      ...ENGINE,
      create: (seed) => ({ ...ENGINE.create(seed, 0), taps: Number.NaN }),
    };
    expect(engineContractProblems(inputWith(lossy))[0]).toContain('state.taps is NaN');
  });

  it('reports a move from intentToMove that listMoves does not list', () => {
    const sloppy: typeof ENGINE = { ...ENGINE, intentToMove: () => ({ kind: 'add', col: 7 }) };
    expect(engineContractProblems(inputWith(sloppy))[0]).toContain('which listMoves does not list');
  });

  it('reports a panMode outside the four modes', () => {
    const tilting = { ...ENGINE, panMode: 'tilt' } as unknown as typeof ENGINE;
    expect(engineContractProblems(inputWith(tilting))[0]).toContain(
      "panMode 'tilt' is not 'none', 'swipe', 'drag' or 'aim'",
    );
  });

  it('reports an intent that the pan mode never lets the board send', () => {
    const swiped: typeof ENGINE = {
      ...ENGINE,
      intentToMove: (state, intent) =>
        intent.kind === 'swipe' ? (ENGINE.listMoves(state)[0] ?? null) : null,
    };
    const swipe: InputIntent = { kind: 'swipe', direction: 'left', from: null };
    const problems = engineContractProblems({ ...inputWith(swiped), intents: () => [swipe] });
    expect(problems[0]).toContain(
      "accepts a swipe intent, but with panMode 'none' the board never sends one (panMode 'swipe')",
    );
    const swiping = { ...swiped, panMode: 'swipe' } as const;
    expect(engineContractProblems({ ...inputWith(swiping), intents: () => [swipe] })).toStrictEqual(
      [],
    );
  });

  it('reports selectRegions that is not a list of region ids', () => {
    const broken = { ...ENGINE, selectRegions: 'picker' } as unknown as typeof ENGINE;
    expect(engineContractProblems(inputWith(broken))[0]).toContain(
      'selectRegions picker is not a list of region ids',
    );
  });

  it('accepts taps that select first and act on the next tap, the selection being UI state', () => {
    const problems = engineContractProblems({
      ...inputWith(PICKING),
      intents: () => [...PICKS, ...TAPS],
    });
    expect(problems).toStrictEqual([]);
  });

  it('reports a tap inside a select region that makes a move instead of selecting', () => {
    const eager: typeof ENGINE = { ...ENGINE, selectRegions: ['board'] };
    expect(engineContractProblems(inputWith(eager))[0]).toContain(
      'but a tap in a select region only selects (return null)',
    );
  });

  it('reports a move made from a tap with a selection that listMoves does not list', () => {
    const sloppy: typeof ENGINE = {
      ...PICKING,
      intentToMove: (_state, intent) =>
        intent.kind === 'tap' && intent.selected !== null ? { kind: 'add', col: 9 } : null,
    };
    const problems = engineContractProblems({
      ...inputWith(sloppy),
      intents: () => [...PICKS, ...TAPS],
    });
    expect(problems[0]).toContain('"selected":{"regionId":"picker","col":0,"row":0}');
    expect(problems[0]).toContain('which listMoves does not list');
  });

  it('reports an endless run that can be won, and accepts one that only ever ends lost', () => {
    const endless = { kind: 'endless', difficulty: 100 } as const;
    const winnable = engineContractProblems({ ...inputWith(ENGINE), intents: () => [], endless });
    expect(winnable.join('\n')).toContain('difficulty 100: the endless run was won (score');
    const survival: typeof ENGINE = {
      ...ENGINE,
      create: (seed, difficulty) => ({ cols: [seed % 2, 0, 0], taps: difficulty === 100 ? 5 : 0 }),
    };
    expect(
      engineContractProblems({ ...inputWith(survival), intents: () => [], endless }),
    ).toStrictEqual([]);
  });

  it('reports a lose reason outside the game catalog', () => {
    const early: typeof ENGINE = {
      ...ENGINE,
      listMoves: (state) => (state.taps >= 2 ? [] : ENGINE.listMoves(state)),
      outcome: (state) =>
        state.taps >= 2 ? { kind: 'lost', reasonKey: 'out-of-taps' } : ENGINE.outcome(state),
    };
    expect(engineContractProblems(inputWith(early))[0]).toContain('is not a tally.* catalog key');
  });

  it('reports listMoves offering moves after the game ended', () => {
    const endless: typeof ENGINE = { ...ENGINE, listMoves: () => [{ kind: 'add', col: 0 }] };
    const problems = engineContractProblems({ ...inputWith(endless), intents: () => [] });
    expect(problems.join('\n')).toContain('moves while outcome is lost');
  });

  it('reports a win score that is not a whole number', () => {
    const fractional: typeof ENGINE = {
      ...ENGINE,
      outcome: (state) => {
        const result = ENGINE.outcome(state);
        return result.kind === 'won' ? { kind: 'won', score: 0.5 } : result;
      },
    };
    const problems = engineContractProblems({ ...inputWith(fractional), intents: () => [] });
    expect(problems.join('\n')).toContain('is not a whole number');
  });

  it('reports parsers that do not return saved states and moves unchanged', () => {
    const lossy = { parseState: () => null, parseMove: () => null };
    const problems = engineContractProblems({ ...inputWith(ENGINE), persistence: lossy });
    expect(problems.join('\n')).toContain('parseState does not return a saved state unchanged');
    expect(problems.join('\n')).toContain('parseMove does not return');
  });

  it('reports an event without a kebab-case kind', () => {
    const notKebab = ['Column', 'Added'].join('');
    const shouting: typeof ENGINE = {
      ...ENGINE,
      applyMove: (state, move) => ({
        ...ENGINE.applyMove(state, move),
        events: [{ kind: notKebab, col: move.col } as unknown as Added],
      }),
    };
    expect(engineContractProblems(inputWith(shouting))[0]).toContain('has no kebab-case kind');
  });

  it('reports a create that starts a finished game', () => {
    const solved: typeof ENGINE = { ...ENGINE, create: () => ({ cols: [2, 2, 2], taps: 0 }) };
    const problems = engineContractProblems({ ...inputWith(solved), intents: () => [] });
    expect(problems.join('\n')).toContain('create starts a game that is already won');
  });

  it('reports create and replays that differ between two runs', () => {
    let calls = 0;
    const drifting: typeof ENGINE = {
      ...ENGINE,
      create: (seed) => {
        calls += 1;
        return { cols: [seed % 2, 0, 0], taps: calls % 2 };
      },
    };
    const problems = engineContractProblems({ ...inputWith(drifting), intents: () => [] });
    expect(problems.join('\n')).toContain('create gives two different states');
    expect(problems.join('\n')).toContain('replaying the same moves');
  });
});
