// apps/stepstone/src/rules/hops.test.ts
// Spec 13 (stepstone): the stone the frog stands on sets its next hop (knight, rook, bishop...).
import fc from 'fast-check';

import { hopKindOf, isLive, isMoveKind, MOVE_KINDS, reachOf, targetsOf } from './hops.ts';
import { pondFromText } from './pond-text.ts';

describe('reachOf', () => {
  it('reaches the eight neighbours of a king, fewer at a corner', () => {
    expect(reachOf(3, 4, 'king')).toStrictEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(reachOf(3, 0, 'king')).toStrictEqual([1, 3, 4]);
  });

  it('reaches every cell of the row and the column of a rook', () => {
    expect(reachOf(4, 5, 'rook')).toStrictEqual([1, 4, 6, 7, 9, 13]);
  });

  it('reaches every cell of both diagonals of a bishop', () => {
    expect(reachOf(4, 5, 'bishop')).toStrictEqual([0, 2, 8, 10, 15]);
  });

  it("reaches the knight's leaps that stay on the pond", () => {
    expect(reachOf(4, 5, 'knight')).toStrictEqual([3, 11, 12, 14]);
  });

  it('keeps every reach inside the pond and off its own cell', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 9 }),
        fc.nat(),
        fc.constantFrom(...MOVE_KINDS),
        (side, pick, kind) => {
          const cell = pick % (side * side);
          const reach = reachOf(side, cell, kind);
          expect(reach).not.toContain(cell);
          expect(reach.every((target) => target >= 0 && target < side * side)).toBe(true);
        },
      ),
    );
  });

  it('is symmetric: a hop of a kind from a to b means the same kind reaches a from b', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 9 }),
        fc.nat(),
        fc.constantFrom(...MOVE_KINDS),
        (side, pick, kind) => {
          const cell = pick % (side * side);
          for (const target of reachOf(side, cell, kind))
            expect(reachOf(side, target, kind)).toContain(cell);
        },
      ),
    );
  });
});

describe('targetsOf', () => {
  it('keeps the live stones the hop reaches and drops water and sunk stones', () => {
    expect(targetsOf(pondFromText(['r.K', '~..', 'B.F'].join('\n')))).toStrictEqual([2, 6]);
  });

  it('gives none once the frog stands on the flag', () => {
    expect(targetsOf(pondFromText(['RRf', 'RRR', 'RRR'].join('\n')))).toStrictEqual([]);
  });
});

describe('the cell helpers', () => {
  it('tells hop stones from water, sunk stones and the flag', () => {
    expect(MOVE_KINDS.every(isMoveKind)).toBe(true);
    expect((['water', 'sunk', 'flag'] as const).some(isMoveKind)).toBe(false);
    expect(isLive('flag')).toBe(true);
    expect(isLive('water') || isLive('sunk')).toBe(false);
  });

  it("reads the frog's hop from its stone", () => {
    expect(hopKindOf(pondFromText(['n.', '.F'].join('\n')))).toBe('knight');
    expect(hopKindOf(pondFromText(['f.', '.R'].join('\n')))).toBeNull();
  });
});
