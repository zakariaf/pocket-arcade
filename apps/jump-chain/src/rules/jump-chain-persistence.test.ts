// apps/jump-chain/src/rules/jump-chain-persistence.test.ts
// Spec 8.6 and N10: a run survives every kill and every update; spec 8.14: a saved run that no
// longer parses is dropped alone, never a crash.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { randomPolicy } from '@e07/game-kit/testing/play-bot.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';
import { jumpChainBot } from '@e07/jump-chain/testing/jump-chain-bot.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { JUMP_CHAIN_PERSISTENCE, parseMove, parseState } from './jump-chain-persistence.ts';
import { marchEveryFor } from './jump-chain-tuning.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { JumpChainMove, JumpChainState } from './jump-chain-types.ts';

const RULES = { listMoves, applyMove };
const START = create(1, 0);
const seedArb = fc.nat();
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 30 });

/** What the save holds: the value after a JSON round trip. */
function saved(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/** The start state as a plain record, to plant one bad field at a time. */
function startRecord(): Record<string, unknown> {
  return saved(START) as Record<string, unknown>;
}

/** The start's front enemy that stands on the board. */
const FIRST = START.enemies.find((enemy) => enemy.row >= 0) ?? { col: 0, row: 0 };

/** The start record with its enemies changed (the counts stay the start's). */
function withEnemies(
  change: (enemies: readonly JumpChainState['enemies'][number][]) => unknown[],
): Record<string, unknown> {
  return { ...startRecord(), enemies: change(START.enemies) };
}

/** One step next to the front rank, then a capture: a played record (one enemy captured). */
function playedRecord(): Record<string, unknown> {
  const stepped = applyMove(START, { kind: 'step', to: { col: 4, row: 6 } }).state;
  return saved(applyMove(stepped, { kind: 'jump', path: [{ col: 6, row: 4 }] }).state) as Record<
    string,
    unknown
  >;
}

/**
 * Every state a bot game reaches from (seed, difficulty), the greedy bot or a random one, with
 * the one continue taken after the first loss: what a save can ever hold.
 */
function botStates(seed: number, difficulty: number, isGreedy: boolean): JumpChainState[] {
  const policy = isGreedy ? jumpChainBot : randomPolicy<JumpChainState, JumpChainMove>();
  let state = create(seed, difficulty);
  let rng = seedRng(seed);
  const states = [state];
  for (let played = 0; played < 200; played += 1) {
    if (outcome(state).kind === 'lost' && !state.hasContinued) {
      state = continueAfterLoss(state).state;
      states.push(state);
    }
    const moves = listMoves(state);
    if (outcome(state).kind !== 'playing' || moves.length === 0) break;
    const choice = policy(state, moves, rng);
    rng = choice.rng;
    state = applyMove(state, choice.move).state;
    states.push(state);
  }
  return states;
}

/** Replays a move line from its start: the run a save restores. */
function replay(start: JumpChainState, moves: readonly JumpChainMove[]): JumpChainState {
  return moves.reduce((state, move) => applyMove(state, move).state, start);
}

/** Every state and move of a played line comes back unchanged from the save. */
function expectRoundTrips(states: readonly JumpChainState[]): void {
  for (const state of states) {
    expect(parseState(saved(state))).toStrictEqual(state);
    for (const move of listMoves(state)) expect(parseMove(saved(move))).toStrictEqual(move);
  }
}

describe('parseState', () => {
  it('returns a saved start unchanged, the endless run included', () => {
    expect(parseState(saved(START))).toStrictEqual(START);
    const endless = create(4, ENDLESS_DIFFICULTY);
    expect(parseState(saved(endless))).toStrictEqual(endless);
  });

  it('returns every state reached by legal play unchanged, and every move it lists', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        expectRoundTrips(playChoices(RULES, create(seed, difficulty), choices).states);
      }),
      { numRuns: 40 },
    );
  });

  it('returns every state a bot game reaches unchanged, continues and endings included', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, fc.boolean(), (seed, difficulty, isGreedy) => {
        for (const state of botStates(seed, difficulty, isGreedy)) {
          expect(parseState(saved(state))).toStrictEqual(state);
        }
      }),
      { numRuns: 30 },
    );
  });

  it('accepts a won level whose march clock ran out on the winning move', () => {
    const won = { ...startRecord(), enemies: [], captured: START.total, ranksCleared: 3 };
    expect(parseState({ ...won, score: 10 * START.total + 150, marchIn: 0 })).not.toBeNull();
  });

  it.each([
    ['text', 'garbage'],
    ['a missing field', { ...startRecord(), score: undefined }],
    ['an extra field', { ...startRecord(), lives: 3 }],
    ['a field of the wrong type', { ...startRecord(), hasContinued: 'no' }],
    ['a difficulty above 100', { ...startRecord(), difficulty: 101 }],
    ['a negative score', { ...startRecord(), score: -1 }],
    ['a piece that is not a square', { ...startRecord(), piece: 7 }],
    ['a piece off the board', { ...startRecord(), piece: { col: 7, row: 7 } }],
    ['a piece on a light square', { ...startRecord(), piece: { col: 3, row: 6 } }],
    ['enemies that are not a list', { ...startRecord(), enemies: {} }],
    [
      'an enemy on an even row',
      { ...startRecord(), enemies: [{ id: 0, rank: 0, col: 2, row: 4 }], total: 1 },
    ],
    [
      'an enemy past your side',
      { ...startRecord(), enemies: [{ id: 0, rank: 0, col: 3, row: 11 }], total: 1 },
    ],
    [
      'an enemy with an extra field',
      { ...startRecord(), enemies: [{ id: 0, rank: 0, col: 3, row: 5, hp: 2 }], total: 1 },
    ],
    [
      'two enemies with one id',
      {
        ...startRecord(),
        enemies: [
          { id: 0, rank: 0, col: 3, row: 5 },
          { id: 0, rank: 0, col: 1, row: 5 },
        ],
        total: 2,
      },
    ],
    ['counts that do not add up', { ...startRecord(), captured: 5 }],
    ['an id at or above nextId', { ...startRecord(), nextId: 0 }],
    [
      'two enemies on one square',
      withEnemies((enemies) =>
        enemies.map((enemy) => ({ ...enemy, col: FIRST.col, row: FIRST.row })),
      ),
    ],
    ['your piece on an enemy', { ...startRecord(), piece: { col: FIRST.col, row: FIRST.row } }],
    [
      'an enemy of a rank not yet made',
      withEnemies((enemies) =>
        enemies.map((enemy, index) => (index === 0 ? { ...enemy, rank: START.nextRank } : enemy)),
      ),
    ],
    ['more ranks cleared than made', { ...startRecord(), ranksCleared: START.nextRank + 1 }],
    ['a cleared rank not counted', { ...startRecord(), ranksCleared: 1 }],
    [
      'a rank counted as cleared that still has enemies',
      { ...playedRecord(), ranksCleared: 1, score: 1000 },
    ],
    ['a march clock at 0 while playing', { ...startRecord(), marchIn: 0 }],
    [
      'a march clock beyond its pace',
      { ...startRecord(), marchIn: marchEveryFor(START.difficulty, START.nextRank) + 1 },
    ],
    ['a next id that is not the enemies made', { ...startRecord(), nextId: START.total + 1 }],
    [
      'a level with more ranks than it opens with',
      { ...startRecord(), nextRank: START.nextRank + 1, ranksCleared: 1, score: 50 },
    ],
    ['a score below the captures it counts', { ...playedRecord(), score: 9 }],
    ['an RNG state of three words', { ...startRecord(), rng: [1, 2, 3] }],
    ['an RNG word above 32 bits', { ...startRecord(), rng: [1, 2, 3, 2 ** 33] }],
  ])('rejects %s', (_name, json) => {
    expect(parseState(json)).toBeNull();
  });
});

describe('parseMove', () => {
  it('accepts a logged step and a logged chain', () => {
    expect(parseMove({ kind: 'step', to: { col: 2, row: 6 } })).toStrictEqual({
      kind: 'step',
      to: { col: 2, row: 6 },
    });
    const chain = {
      kind: 'jump',
      path: [
        { col: 4, row: 4 },
        { col: 6, row: 2 },
      ],
    };
    expect(parseMove(chain)).toStrictEqual(chain);
  });

  it.each([
    [null],
    [{ kind: 'step', to: { col: 7, row: 6 } }],
    [{ kind: 'step', to: { col: 3, row: 6 } }],
    [{ kind: 'step', to: { col: 2, row: 6 }, extra: 1 }],
    [{ kind: 'jump', path: [] }],
    [
      {
        kind: 'jump',
        path: [
          { col: 4, row: 4 },
          { col: 5, row: 3 },
        ],
      },
    ],
    [
      {
        kind: 'jump',
        path: [
          { col: 4, row: 4 },
          { col: 4, row: 0 },
        ],
      },
    ],
    [{ kind: 'jump', path: 'up' }],
    [{ kind: 'jump', path: [{ col: 4, row: 4 }], extra: 1 }],
    [
      {
        kind: 'jump',
        path: Array.from({ length: 71 }, (_, index) => ({
          col: (index % 2) * 2,
          row: (index % 2) * 2,
        })),
      },
    ],
    [{ kind: 'wait' }],
  ])('rejects %j', (json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('a saved run', () => {
  it('replays its saved move line to the same state', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const start = create(seed, difficulty);
        const line: JumpChainMove[] = [];
        let state = start;
        for (const choice of choices) {
          const moves = listMoves(state);
          const move = moves[choice % Math.max(moves.length, 1)];
          if (move === undefined) break;
          line.push(move);
          state = applyMove(state, move).state;
        }
        const restored = line.map((move) => parseMove(saved(move)));
        expect(restored.every((move) => move !== null)).toBe(true);
        expect(replay(start, line)).toStrictEqual(state);
      }),
      { numRuns: 40 },
    );
  });
});

describe('JUMP_CHAIN_PERSISTENCE', () => {
  it('drops a run saved in an older state version (version 1 has nothing to migrate)', () => {
    expect(JUMP_CHAIN_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });

  it('saves after every move (a turn-based game)', () => {
    expect(JUMP_CHAIN_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
    expect(JUMP_CHAIN_PERSISTENCE.stateVersion).toBe(GOLDEN_STATE_VERSION);
  });
});

const GOLDEN_STATE_VERSION = 1;
