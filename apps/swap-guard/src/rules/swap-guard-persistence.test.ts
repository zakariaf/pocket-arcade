// apps/swap-guard/src/rules/swap-guard-persistence.test.ts
// Spec 8.6 and N10: a run survives every kill and every app update; a saved run that no longer
// parses is dropped alone (spec 8.14), never a crash.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { SWAP_GUARD_PERSISTENCE, parseMove, parseState } from './swap-guard-persistence.ts';

import type { SwapGuardMove, SwapGuardState } from './swap-guard-types.ts';

const playArb = fc.tuple(
  fc.nat(),
  fc.integer({ min: 0, max: 100 }),
  fc.array(fc.nat(), { maxLength: 24 }),
);

const fromJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

function played(seed: number, difficulty: number, choices: readonly number[]) {
  return playChoices({ listMoves, applyMove }, create(seed, difficulty), choices);
}

/** The move line a player makes with these choices (playChoices' choice rule), and its end. */
function playedLine(
  seed: number,
  difficulty: number,
  choices: readonly number[],
): { readonly moves: SwapGuardMove[]; readonly end: SwapGuardState } {
  const moves: SwapGuardMove[] = [];
  let end = create(seed, difficulty);
  for (const choice of choices) {
    const listed = listMoves(end);
    const move = listed[choice % Math.max(listed.length, 1)];
    if (move === undefined) break;
    moves.push(move);
    end = applyMove(end, move).state;
  }
  return { moves, end };
}

/** The run rebuilt from its start and its saved move line, each move parsed back first. */
function replay(start: SwapGuardState, moves: readonly SwapGuardMove[]): SwapGuardState {
  return moves.reduce((state, move) => {
    const parsed = parseMove(fromJson(move));
    if (parsed === null) throw new Error(`a saved move did not parse: ${JSON.stringify(move)}`);
    return applyMove(state, parsed).state;
  }, start);
}

const START = create(1, 0);

/** The first swap from START that lands the guard in a strike: a lost run with a swap to undo. */
function lostRun(): SwapGuardState {
  const lost = listMoves(START)
    .map((move) => applyMove(START, move).state)
    .find((state) => state.isHit);
  if (lost === undefined) throw new Error('START has no losing swap');
  return lost;
}

/** The opening double hit of START: two enemies knocked out, a swap on record. */
function afterDoubleHit(): SwapGuardState {
  const best = listMoves(START)
    .map((move) => applyMove(START, move).state)
    .find((state) => !state.isHit && state.enemies.length === START.enemies.length - 2);
  if (best === undefined) throw new Error('START has no double hit');
  return best;
}

const HIT = afterDoubleHit();
const SPEAR = START.enemies[0];

describe('parseState (spec 8.6: a saved run comes back exactly)', () => {
  it('returns a saved start unchanged after a JSON round trip', () => {
    expect(parseState(fromJson(START))).toStrictEqual(START);
  });

  it('returns a lost run and the run its continue made unchanged', () => {
    const lost = lostRun();
    const continued = continueAfterLoss(lost).state;
    expect(parseState(fromJson(lost))).toStrictEqual(lost);
    expect(parseState(fromJson(continued))).toStrictEqual(continued);
  });

  it('returns every state reached by legal play unchanged (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const { states } = played(seed, difficulty, choices);
        expect(states.map((state) => parseState(fromJson(state)))).toStrictEqual(states);
      }),
    );
  });

  it.each([
    ['text', 'garbage'],
    ['null', null],
    ['an array', [START]],
    ['a missing field', { ...START, score: undefined }],
    ['an extra field', { ...START, cheat: true }],
    ['a field of the wrong type', { ...START, swaps: '0' }],
    ['a board size no tuning row has', { ...START, size: 9 }],
    ['the guard off the board', { ...START, guard: 25 }],
    ['a negative score', { ...START, score: -100 }],
    ['more swaps than the budget', { ...START, swaps: START.maxSwaps + 1 }],
    ['a budget larger than any tuning row', { ...START, maxSwaps: 99 }],
    ['a hit flag that is not a boolean', { ...START, isHit: 'no' }],
    ['a continue flag that is not a boolean', { ...START, hasContinued: 1 }],
    ['an enemy of an unknown kind', { ...START, enemies: [{ ...SPEAR, kind: 'dragon' }] }],
    ['an enemy facing nowhere', { ...START, enemies: [{ ...SPEAR, facing: 'north' }] }],
    ['an enemy with an extra field', { ...START, enemies: [{ ...SPEAR, hp: 3 }] }],
    ['an enemy off the board', { ...START, enemies: [{ ...SPEAR, cell: 30 }] }],
    ['an enemy on the guard', { ...START, enemies: [{ ...SPEAR, cell: START.guard }] }],
    [
      'a brute that faces a side',
      { ...START, enemies: [{ id: 0, kind: 'brute', facing: 'left', cell: 12 }] },
    ],
    [
      'two enemies on one square',
      {
        ...START,
        enemies: [
          { ...SPEAR, id: 0 },
          { ...SPEAR, id: 1 },
        ],
      },
    ],
    ['enemies out of id order', { ...START, enemies: [...START.enemies].reverse() }],
    ['an enemy id beyond the level count', { ...START, enemies: [{ ...SPEAR, id: 7 }] }],
    ['more enemies standing than the level had', { ...START, enemyCount: 1 }],
    ['a score with no enemy knocked out', { ...START, score: 100 }],
    ['enemies knocked out with no score', { ...HIT, score: 0 }],
    ['a score above what the knock-outs can earn', { ...HIT, score: 10_000 }],
    ['a swap on record with no swap made', { ...START, lastSwap: HIT.lastSwap }],
    ['a hit run with no swap on record', { ...HIT, isHit: true, lastSwap: null }],
    ['a last swap that did not end on the guard', { ...HIT, guard: START.guard }],
    ['a last swap between squares far apart', { ...HIT, lastSwap: { ...HIT.lastSwap, from: 24 } }],
    [
      'volley points that do not match its knock-outs',
      { ...HIT, lastSwap: { ...HIT.lastSwap, points: 1 } },
    ],
    [
      'a knocked-out enemy that still stands',
      { ...HIT, lastSwap: { ...HIT.lastSwap, defeated: [HIT.enemies[0]] } },
    ],
  ])('refuses %s', (_name, json) => {
    expect(parseState(fromJson(json))).toBeNull();
  });
});

describe('parseMove', () => {
  it('accepts every listed swap after a JSON round trip', () => {
    for (const move of listMoves(START)) expect(parseMove(fromJson(move))).toStrictEqual(move);
  });

  it.each([
    [null],
    ['swap'],
    [{ kind: 'swap' }],
    [{ kind: 'jump', cell: 3 }],
    [{ kind: 'swap', cell: -1 }],
    [{ kind: 'swap', cell: 2.5 }],
    [{ kind: 'swap', cell: 36 }],
    [{ kind: 'swap', cell: 3, extra: 1 }],
  ])('refuses %j (no square of any board)', (json) => {
    expect(parseMove(json)).toBeNull();
  });

  it('rebuilds the same run from the saved move line (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const { moves, end } = playedLine(seed, difficulty, choices);
        expect(replay(create(seed, difficulty), moves)).toStrictEqual(end);
      }),
    );
  });
});

describe('SWAP_GUARD_PERSISTENCE', () => {
  it('drops a run saved in an older state version (version 1 has nothing to migrate)', () => {
    expect(SWAP_GUARD_PERSISTENCE.stateVersion).toBe(1);
    expect(SWAP_GUARD_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });

  it('saves after every move (a turn-based game: every move is written before it is shown)', () => {
    expect(SWAP_GUARD_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
  });
});
