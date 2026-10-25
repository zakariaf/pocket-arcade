// apps/flock-tilt/src/levels/flock-tilt-solver.test.ts
import fc from 'fast-check';

import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { create } from '@e07/flock-tilt/rules/create.ts';
import { fieldKey } from '@e07/flock-tilt/rules/field-search.ts';
import { parseField } from '@e07/flock-tilt/rules/field-text.ts';
import { TUNING, knobsFor } from '@e07/flock-tilt/rules/flock-tilt-tuning.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome } from '@e07/flock-tilt/rules/outcome.ts';
import { DIRECTIONS, tiltField } from '@e07/flock-tilt/rules/tilt-field.ts';
import { dailySeed } from '@e07/game-kit/dates/daily-seed.ts';
import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';

import {
  FLOCK_TILT_DAILY_DIFFICULTY,
  FLOCK_TILT_DAILY_SALT,
  FLOCK_TILT_LEVELS,
} from './flock-tilt-levels.ts';
import { FLOCK_TILT_SOLVER, HINT_MAX_NODES, suggestTilt } from './flock-tilt-solver.ts';

import type {
  Field,
  FlockTiltMove,
  FlockTiltState,
} from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

const ENGINE = { listMoves, applyMove, outcome };

function stateOf(
  lines: readonly string[],
  overrides: Partial<FlockTiltState> = {},
): FlockTiltState {
  return {
    ...parseField(lines),
    tilts: 0,
    tiltLimit: TUNING.tiltLimit,
    par: 2,
    hasContinued: false,
    beforeLoss: null,
    ...overrides,
  };
}

describe('FLOCK_TILT_SOLVER (spec 8.1: "the solver also calculates par")', () => {
  it('finds the two tilts that pen a sheep in the far corner (par 2)', () => {
    const result = FLOCK_TILT_SOLVER.solve(stateOf(['s....', '....o', 'w....']), 1000);
    expect(result.kind).toBe('solved');
    expect(result.kind === 'solved' ? result.par : -1).toBe(2);
  });

  it('pens a lined-up flock with one tilt', () => {
    expect(FLOCK_TILT_SOLVER.solve(stateOf(['o.sss', '.....', '....w']), 1000)).toStrictEqual({
      kind: 'solved',
      par: 1,
      line: [{ kind: 'tilt', direction: 'left' }],
      final: applyMove(stateOf(['o.sss', '.....', '....w']), { kind: 'tilt', direction: 'left' })
        .state,
    });
  });

  it('reports a field no tilt can win as unsolvable, and stops at the node budget', () => {
    expect(FLOCK_TILT_SOLVER.solve(stateOf(['s#...', '#...o', '....w']), 1000)).toStrictEqual({
      kind: 'unsolvable',
    });
    expect(FLOCK_TILT_SOLVER.solve(create(3, 80), 1)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('solves every generated field at the par create recorded, with a line the engine accepts', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const result = FLOCK_TILT_SOLVER.solve(start, 60_000);
        const line = result.kind === 'solved' ? result.line : [];
        expect(result.kind === 'solved' ? result.par : -1).toBe(start.par);
        expect(start.par).toBeLessThanOrEqual(knobsFor(difficulty).maxPar);
        expect(verifyLine(ENGINE, start, line)).toStrictEqual({ kind: 'wins', moves: start.par });
      }),
      { seed: 19, numRuns: 40 },
    );
  });
});

describe('suggestTilt (spec 8.5: "The game\'s solver suggests the next good move")', () => {
  it('suggests the first tilt of a shortest winning line', () => {
    expect(suggestTilt(stateOf(['.....', 's...o', 'w....']))).toStrictEqual({
      kind: 'tilt',
      direction: 'right',
    });
  });

  it('keeps the field winnable from every state on the solver line', () => {
    const start = create(5, 40);
    let state = start;
    for (let step = 0; step < start.par; step += 1) {
      const hint = suggestTilt(state);
      expect(hint).not.toBeNull();
      expect(listMoves(state)).toContainEqual(hint);
      state = applyMove(state, hint ?? { kind: 'tilt', direction: 'up' }).state;
    }
    expect(outcome(state).kind).toBe('won');
  });

  it('gives a fresh first move from a state off the solver line', () => {
    const start = create(6, 10);
    const offLine = listMoves(start)
      .map((move) => applyMove(start, move).state)
      .find((state) => outcome(state).kind === 'playing' && suggestTilt(state) !== null);
    const hint = offLine === undefined ? null : suggestTilt(offLine);
    const solved = offLine === undefined ? null : FLOCK_TILT_SOLVER.solve(offLine, 60_000);
    expect(hint).toStrictEqual(solved?.kind === 'solved' ? solved.line[0] : undefined);
  });

  it('gives no hint once the run is won or lost, or when the field can no longer be won', () => {
    const won = stateOf(['s...o'], { sheep: [{ id: 0, cell: 4, status: 'penned' }] });
    const lost = stateOf(['s...o', 'w....'], { sheep: [{ id: 0, cell: 0, status: 'lost' }] });
    const stuck = stateOf(['s#...', '#...o', '....w']);
    expect([won, lost, stuck].map(suggestTilt)).toStrictEqual([null, null, null]);
  });
});

/** The hint the engine solver gives: the first tilt of its shortest line inside the hint budget. */
function engineHint(state: FlockTiltState): FlockTiltMove | null {
  if (outcome(state).kind !== 'playing') return null;
  const result = FLOCK_TILT_SOLVER.solve(state, HINT_MAX_NODES);
  return result.kind === 'solved' ? (result.line[0] ?? null) : null;
}

/** A start, every playing state one tilt away, and the start with only par or par - 1 tilts left. */
function hintStates(start: FlockTiltState): FlockTiltState[] {
  const next = listMoves(start).map((move) => applyMove(start, move).state);
  const spare = [start.par, start.par - 1].map((left) => ({
    ...start,
    tilts: start.tiltLimit - left,
  }));
  return [start, ...next, ...spare].filter((state) => outcome(state).kind === 'playing');
}

describe('suggestTilt on the shipped fields', () => {
  const levels = FLOCK_TILT_LEVELS.table.map((entry) => create(entry.seed, entry.difficulty));
  const days = Array.from({ length: 31 }, (_, day): DateKey => {
    return `2026-10-${String(day + 1).padStart(2, '0')}`;
  });
  const dailies = days.map((date) =>
    create(dailySeed(date, FLOCK_TILT_DAILY_SALT), FLOCK_TILT_DAILY_DIFFICULTY),
  );

  it("gives the engine solver's first tilt on every level and daily field and one tilt on", () => {
    const states = [...levels, ...dailies].flatMap(hintStates);
    expect(states.length).toBeGreaterThan(levels.length * 3);
    for (const state of states) expect(suggestTilt(state)).toStrictEqual(engineHint(state));
  });
});

/** Every flock a field can reach without losing a sheep, however many tilts it takes. */
function reachableFlocks(field: Field): number {
  const seen = new Set<string>([fieldKey(field)]);
  const queue: Field[] = [field];
  // for-of over an array also visits the flocks pushed while it runs (a breadth-first queue).
  for (const current of queue) {
    for (const direction of DIRECTIONS) {
      const tilted = tiltField(current, direction);
      const key = fieldKey(tilted);
      if (seen.has(key)) continue;
      seen.add(key);
      if (tilted.losses.length === 0) {
        queue.push({ ...current, sheep: tilted.sheep, wolves: tilted.wolves });
      }
    }
  }
  return seen.size;
}

describe('the hint budget on the shipped fields', () => {
  it('holds every flock a level or daily field can reach mid-run, so a hint search never runs out', () => {
    const levels = FLOCK_TILT_LEVELS.table.map((entry) => create(entry.seed, entry.difficulty));
    const dailies = Array.from({ length: 31 }, (_, day) => {
      const date: DateKey = `2026-12-${String(day + 1).padStart(2, '0')}`;
      return create(dailySeed(date, FLOCK_TILT_DAILY_SALT), FLOCK_TILT_DAILY_DIFFICULTY);
    });
    const largest = Math.max(...[...levels, ...dailies].map(reachableFlocks));
    expect(largest).toBeLessThan(HINT_MAX_NODES / 4);
  });
});
