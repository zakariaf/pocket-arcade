// packages/game-kit/src/geom/sweep.test.ts
import fc from 'fast-check';

import { sweepCircleSegment } from './sweep.ts';
import { length, reflect } from './vec2.ts';

const FLOOR = { a: { x: 0, y: 100 }, b: { x: 200, y: 100 } };

describe('sweepCircleSegment', () => {
  it('finds the contact time and normal against a wall', () => {
    const hit = sweepCircleSegment(
      { center: { x: 50, y: 50 }, motion: { x: 0, y: 80 }, radius: 10 },
      FLOOR,
    );
    expect(hit?.t).toBe(0.5);
    expect(hit?.normal.y).toBe(-1);
  });

  it('hits the rounded end of a segment', () => {
    const hit = sweepCircleSegment(
      { center: { x: 230, y: 100 }, motion: { x: -40, y: 0 }, radius: 10 },
      FLOOR,
    );
    expect(hit?.t).toBeCloseTo(0.5);
  });

  it('keeps the speed unchanged on reflection', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: -500, max: 500, noNaN: true }),
        (vx, vy) => {
          const out = reflect({ x: vx, y: vy }, { x: 0, y: -1 });
          expect(length(out)).toBeCloseTo(length({ x: vx, y: vy }), 9);
        },
      ),
      { seed: 5, numRuns: 300 },
    );
  });
});
