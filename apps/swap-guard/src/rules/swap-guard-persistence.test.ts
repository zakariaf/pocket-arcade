// apps/swap-guard/src/rules/swap-guard-persistence.test.ts
// Spec 8.6 and N10: a run survives every kill and every app update; a saved run that no longer
// parses is dropped alone (spec 8.14), never a crash.
import fc from 'fast-check';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { continueAfterLoss } from './continue-run.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { SWAP_GUARD_PERSISTENCE, parseMove, parseState } from './swap-guard-persistence.ts';
import { volleyPoints } from './swap-guard-tuning.ts';

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
const LOST = lostRun();
const SPEAR = START.enemies[0];

/** HIT, with one more enemy on record as knocked out by its volley, though no strike reached it. */
function withUnstruckKnockOut(): unknown {
  const [standing, ...rest] = HIT.enemies;
  if (standing === undefined || HIT.lastSwap === null) throw new Error('HIT has nobody standing');
  const defeated = [...HIT.lastSwap.defeated, standing];
  const points = volleyPoints(defeated.length);
  return { ...HIT, enemies: rest, score: points, lastSwap: { ...HIT.lastSwap, defeated, points } };
}

/** START with `extra` more spears standing in the top row's corners and beyond (ids from 3). */
function withMoreSpears(extra: number): SwapGuardState {
  const cells = [0, 4, 20, 24].slice(0, extra);
  const added = cells.map((cell, index) => ({
    id: START.enemies.length + index,
    kind: 'spear' as const,
    facing: 'up' as const,
    cell,
  }));
  return { ...START, enemies: [...START.enemies, ...added], enemyCount: 3 + extra };
}

/** The run LOST's continue made: the board before the losing swap, the continue used. */
const CONTINUED = continueAfterLoss(LOST).state;

/** HIT with its second knock-out on record under an id the level never had. */
function withDefeatedIdBeyondCount(): unknown {
  if (HIT.lastSwap === null) throw new Error('HIT has no swap on record');
  const defeated = HIT.lastSwap.defeated.map((enemy, index) =>
    index === 1 ? { ...enemy, id: 5 } : enemy,
  );
  return { ...HIT, lastSwap: { ...HIT.lastSwap, defeated } };
}

/** Seeded random swaps to the end, with the one continue after a loss: every state on the way. */
function statesWithContinue(seed: number, difficulty: number, choices: readonly number[]) {
  const states: SwapGuardState[] = [create(seed, difficulty)];
  let state = pickAt(states, 0);
  for (const choice of choices) {
    if (state.isHit || state.swaps >= state.maxSwaps) {
      if (state.hasContinued || state.enemies.length === 0) break;
      state = continueAfterLoss(state).state;
    } else {
      const moves = listMoves(state);
      if (moves.length === 0) break;
      state = applyMove(state, pickAt(moves, choice % moves.length)).state;
    }
    states.push(state);
  }
  return states;
}

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

  it('returns every state of play with a continue after the loss unchanged (property)', () => {
    fc.assert(
      fc.property(playArb, ([seed, difficulty, choices]) => {
        const states = statesWithContinue(seed, difficulty, choices);
        expect(states.map((state) => parseState(fromJson(state)))).toStrictEqual(states);
      }),
    );
  });

  it.each([
    ['text', 'garbage'],
    // The tuning rows say what a board of each size can hold (create never makes anything else).
    ['a board size saved as text', { ...START, size: '5' }],
    ['a budget no row of that size has', { ...START, maxSwaps: 15 }],
    ['more enemies than any row of that size', withMoreSpears(2)],
    ['fewer enemies than create ever makes', { ...START, enemies: [SPEAR], enemyCount: 1 }],
    [
      'an enemy kind no row of that size draws',
      {
        ...START,
        enemies: [
          SPEAR,
          ...START.enemies.slice(1, 2),
          { id: 2, kind: 'brute', facing: 'up', cell: 0 },
        ],
      },
    ],
    // A continue goes back to the board before a losing swap: a swap left and an enemy standing.
    ['a continued run with no swap left', { ...CONTINUED, swaps: CONTINUED.maxSwaps }],
    [
      'a continued run with no enemy standing',
      { ...CONTINUED, enemies: [], swaps: 2, score: volleyPoints(1) * 3 },
    ],
    ['a knock-out on record under an id the level never had', withDefeatedIdBeyondCount()],
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
    // Legal play cannot reach these (spec 8.6: a run comes back exactly, or is dropped alone).
    ['a score no volleys add up to', { ...HIT, score: HIT.score - 25 }],
    ['swaps made with none on record and no continue', { ...HIT, lastSwap: null }],
    ['a hit flag on a guard no strike reached', { ...HIT, isHit: true }],
    ['a guard standing in a strike with no hit flag', { ...LOST, isHit: false }],
    ['a knock-out on record that no strike reached', withUnstruckKnockOut()],
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
