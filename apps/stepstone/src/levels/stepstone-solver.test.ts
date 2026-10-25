// apps/stepstone/src/levels/stepstone-solver.test.ts
// Spec 8.1: "Every level is generated from a seed and a difficulty and checked by a solver, which
// also computes par." Spec 8.5: "The game's solver suggests the next good move."
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { create } from '@e07/stepstone/rules/create.ts';
import { hopDistance } from '@e07/stepstone/rules/hop-distance.ts';
import { listMoves } from '@e07/stepstone/rules/list-moves.ts';
import { outcome } from '@e07/stepstone/rules/outcome.ts';
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import { HINT_MAX_NODES, STEPSTONE_SOLVER, suggestHop } from './stepstone-solver.ts';

import type { StepstoneMove, StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

const ENGINE = { listMoves, applyMove, outcome };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 99 });

function pond(text: string): StepstoneState {
  return { ...pondFromText(text), moves: 0, par: 0, kindsUsed: ['rook'] };
}

/** The rook at 0 reaches the king at 4 (water all round: it strands) and the rook at 10. */
const FORK = pond(['r...K', '.....', 'R...F', '.....', '.....'].join('\n'));
/** The rook at 0 reaches only the king at 4, which strands the frog: no route to the flag. */
const DEAD_END = pond(['r...K', '.....', '....F', '.....', '.....'].join('\n'));

function hop(to: number): StepstoneMove {
  return { kind: 'hop', to };
}

function playLine(start: StepstoneState, line: readonly StepstoneMove[]): StepstoneState {
  return line.reduce((state, move) => applyMove(state, move).state, start);
}

function solvedLine(start: StepstoneState): readonly StepstoneMove[] {
  const result = STEPSTONE_SOLVER.solve(start, HINT_MAX_NODES);
  if (result.kind !== 'solved') throw new Error(`not solved: ${result.kind}`);
  return result.line;
}

/** Every hint along the solver's own line is legal and leaves a route one hop shorter. */
function expectHintsAlongLine(start: StepstoneState): void {
  const line = solvedLine(start);
  line.reduce((state, move, index) => {
    const hint = suggestHop(state);
    if (hint === null) throw new Error(`no hint at hop ${String(index)}`);
    expect(listMoves(state)).toContainEqual(hint);
    expect(solvedLine(applyMove(state, hint).state)).toHaveLength(line.length - index - 1);
    return applyMove(state, move).state;
  }, start);
}

describe('STEPSTONE_SOLVER', () => {
  it('finds the shortest route on a hand-made pond and returns par', () => {
    expect(STEPSTONE_SOLVER.solve(FORK, 100)).toStrictEqual({
      kind: 'solved',
      par: 2,
      line: [hop(10), hop(14)],
      final: playLine(FORK, [hop(10), hop(14)]),
    });
  });

  it('reports a pond whose every hop strands the frog as unsolvable', () => {
    expect(STEPSTONE_SOLVER.solve(DEAD_END, 100)).toStrictEqual({ kind: 'unsolvable' });
  });

  it('stops at the node budget', () => {
    expect(STEPSTONE_SOLVER.solve(create(3, 75), 1)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('solves every generated pond at the par create recorded, with a line the engine accepts', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const start = create(seed, difficulty);
        const result = STEPSTONE_SOLVER.solve(start, HINT_MAX_NODES);
        if (result.kind !== 'solved') throw new Error(`not solved: ${result.kind}`);
        expect(result.par).toBe(start.par);
        expect(result.par).toBe(hopDistance(start));
        expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({
          kind: 'wins',
          moves: result.par,
        });
      }),
      { numRuns: 80 },
    );
  });
});

describe('suggestHop', () => {
  it('suggests the first hop of a shortest route, never the stone that strands', () => {
    expect(suggestHop(FORK)).toStrictEqual(hop(10));
  });

  it('suggests a legal hop that keeps the level solvable from every state on the line', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        expectHintsAlongLine(create(seed, difficulty));
      }),
      { numRuns: 40 },
    );
  });

  it('suggests the first hop of a fresh solve once the player has left the line', () => {
    const start = create(1, 0);
    const [best] = solvedLine(start);
    const off = listMoves(start).find((move) => move.to !== best?.to);
    if (off === undefined) throw new Error('the golden pond offers a second hop');
    const state = applyMove(start, off).state;
    const fresh = STEPSTONE_SOLVER.solve(state, HINT_MAX_NODES);
    expect(suggestHop(state)).toStrictEqual(fresh.kind === 'solved' ? fresh.line[0] : null);
  });

  it('suggests nothing on a won pond, a stranded frog or a pond with no route left', () => {
    const won = playLine(FORK, [hop(10), hop(14)]);
    const stranded = applyMove(FORK, hop(4)).state;
    expect(suggestHop(won)).toBeNull();
    expect(suggestHop(stranded)).toBeNull();
    expect(suggestHop(DEAD_END)).toBeNull();
  });
});
