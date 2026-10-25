// apps/stepstone/src/rules/lay-pond.test.ts
// The pond is laid from a route first, so every level is solvable by construction; the solver still
// proves each shipped level and computes its par (spec 8.1).
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { hopDistance } from './hop-distance.ts';
import { layPond } from './lay-pond.ts';
import { TUNING } from './stepstone-tuning.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const rowArb = fc.constantFrom(...TUNING.levelRows);

describe('layPond', () => {
  it('lays a pond as wide as its row asks, with one flag and the frog on a stone of its kinds', () => {
    fc.assert(
      fc.property(seedArb, rowArb, (seed, knobs) => {
        const { state } = layPond(knobs, seedRng(seed));
        expect(state.cells).toHaveLength(knobs.side * knobs.side);
        expect(state.cells.filter((cell) => cell === 'flag')).toHaveLength(1);
        expect(knobs.kinds).toContain(state.cells[state.frog]);
      }),
      { numRuns: 100 },
    );
  });

  it('always leaves a route to the flag no longer than the laid route', () => {
    fc.assert(
      fc.property(seedArb, rowArb, (seed, knobs) => {
        const { state } = layPond(knobs, seedRng(seed));
        expect(state.par).toBe(hopDistance(state));
        expect(state.par).toBeGreaterThanOrEqual(1);
        expect(state.par).toBeLessThanOrEqual(knobs.routeHops);
      }),
      { numRuns: 100 },
    );
  });

  it('ends the route early and lays no trap when the pond has no free cell left', () => {
    const tiny = { side: 2, kinds: ['king'], routeHops: 9, decoys: 2, minPar: 1 } as const;
    const { state } = layPond(tiny, seedRng(4));
    expect(state.cells.filter((cell) => cell === 'king')).toHaveLength(3);
    expect(state.cells.filter((cell) => cell === 'flag')).toHaveLength(1);
    expect(state.par).toBe(1);
  });

  it('draws on from the stream it is given (the next pond differs)', () => {
    const first = layPond(TUNING.levelRows[0], seedRng(1));
    const second = layPond(TUNING.levelRows[0], first.rng);
    expect(second.state.cells).not.toStrictEqual(first.state.cells);
  });
});
