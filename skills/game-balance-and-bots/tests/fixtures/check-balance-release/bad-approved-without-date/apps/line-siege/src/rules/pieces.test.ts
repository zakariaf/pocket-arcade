// apps/line-siege/src/rules/pieces.test.ts
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { PIECES, TRAY_SIZE, drawTray, pieceAt } from './pieces.ts';

describe('PIECES', () => {
  it('offers about ten block shapes (spec 13: v1 content), each anchored at its top-start cell', () => {
    expect(PIECES).toHaveLength(10);
    for (const piece of PIECES) {
      expect(Math.min(...piece.map(([, dy]) => dy))).toBe(0);
      expect(Math.min(...piece.filter(([, dy]) => dy === 0).map(([dx]) => dx))).toBe(0);
    }
  });
});

describe('pieceAt', () => {
  it('returns the shape of a piece index', () => {
    expect(pieceAt(0)).toStrictEqual([[0, 0]]);
  });

  it('throws for an index outside the piece list', () => {
    expect(() => pieceAt(PIECES.length)).toThrow(RangeError);
  });
});

describe('drawTray', () => {
  it('draws three piece indices from the seeded stream', () => {
    const { tray } = drawTray(seedRng(7));
    expect(tray).toHaveLength(TRAY_SIZE);
    expect(JSON.stringify(tray)).toBe(GOLDEN_SEED_7_TRAY);
  });

  it('gives the same tray and stream for the same RNG state', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (seed) => {
        expect(drawTray(seedRng(seed))).toStrictEqual(drawTray(seedRng(seed)));
        expect(drawTray(seedRng(seed)).tray.every((index) => index < PIECES.length)).toBe(true);
      }),
    );
  });
});

const GOLDEN_SEED_7_TRAY = '[1,1,0]';
