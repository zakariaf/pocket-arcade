// apps/flock-tilt/src/rules/field-search.test.ts
import fc from 'fast-check';

import { fieldKey, sheepBlocks, solveField } from './field-search.ts';
import { parseField } from './field-text.ts';
import { tiltField } from './tilt-field.ts';

import type { FieldSolution } from './field-search.ts';
import type { Direction, Field } from './flock-tilt-types.ts';

/** Plays a line of tilts; returns the field it ends on and whether a sheep was lost on the way. */
function replay(field: Field, line: readonly Direction[]): { field: Field; isLost: boolean } {
  let current = field;
  let isLost = false;
  for (const direction of line) {
    const result = tiltField(current, direction);
    isLost = isLost || result.losses.length > 0;
    current = { ...current, sheep: result.sheep, wolves: result.wolves };
  }
  return { field: current, isLost };
}

function isCleared(field: Field): boolean {
  return field.sheep.every((sheep) => sheep.status === 'penned');
}

/** True when a found line replays to a cleared field without a loss, at par length. */
function provesItself(field: Field, solution: FieldSolution | null): boolean {
  if (solution === null) return true;
  const end = replay(field, solution.line);
  return !end.isLost && isCleared(end.field) && solution.line.length === solution.par;
}

describe('solveField (spec 8.1: the solver also calculates par)', () => {
  it('finds the fewest tilts on a small field', () => {
    const field = parseField(['s....', '....o']);
    const solution = solveField(field, 8, 1000);
    expect(solution?.par).toBe(2);
    expect(solution?.line).toHaveLength(2);
    expect(isCleared(replay(field, solution?.line ?? []).field)).toBe(true);
  });

  it('pens a whole row of sheep with one tilt', () => {
    expect(solveField(parseField(['o.sss', '.....', '....w']), 8, 1000)).toStrictEqual({
      par: 1,
      line: ['left'],
    });
  });

  it('takes no line that loses a sheep to the wolf', () => {
    const field = parseField(['s..w', '....', 'o...']);
    const solution = solveField(field, 8, 5000);
    expect(solution).not.toBeNull();
    expect(replay(field, solution?.line ?? []).isLost).toBe(false);
  });

  it('reports a field no tilt can win as unsolvable (null)', () => {
    expect(solveField(parseField(['s#...', '#...o']), 8, 1000)).toBeNull();
  });

  it('gives up past maxPar and past the node budget', () => {
    const field = parseField(['s....', '....o']);
    expect(solveField(field, 1, 1000)).toBeNull();
    expect(solveField(field, 8, 0)).toBeNull();
  });

  it('pins the line of a known field (GOLDEN_SEARCH_LINE)', () => {
    expect(solveField(parseField(GOLDEN_FIELD), 8, 20_000)).toStrictEqual(GOLDEN_SEARCH_LINE);
  });

  describe('properties', () => {
    it('finds a line that replays to a cleared field without a loss, whenever it finds one', () => {
      fc.assert(
        fc.property(SMALL_FIELD_ARB, (field) => {
          expect(provesItself(field, solveField(field, 6, 5000))).toBe(true);
        }),
      );
    });
  });
});

describe('sheepBlocks (spec 13: "sheep are each other\'s blockers")', () => {
  it('counts every sheep a line of tilts stops against another sheep', () => {
    const field = parseField(['.ss..', '.....', '....o']);
    expect(sheepBlocks(field, ['right'])).toBe(1);
    expect(sheepBlocks(field, ['right', 'left'])).toBe(2);
  });

  it('counts no stop against a rock, the fence, the pen or a wolf', () => {
    expect(sheepBlocks(parseField(['s..#.', '.....', 'w...o']), ['right', 'down'])).toBe(0);
    expect(sheepBlocks(parseField(['s....', '....o']), [])).toBe(0);
  });
});

describe('fieldKey', () => {
  it('ignores which sheep stands where, but not how many are penned', () => {
    const a = parseField(['s.s.o']);
    const swapped = { ...a, sheep: [...a.sheep].reverse() };
    expect(fieldKey(swapped)).toBe(fieldKey(a));
    const penned = a.sheep.map((sheep, index) =>
      index === 0 ? { ...sheep, status: 'penned' as const, cell: 4 } : sheep,
    );
    const lost = a.sheep.map((sheep, index) =>
      index === 0 ? { ...sheep, status: 'lost' as const } : sheep,
    );
    expect(fieldKey({ ...a, sheep: penned })).not.toBe(fieldKey(a));
    expect(fieldKey({ ...a, sheep: lost })).not.toBe(fieldKey({ ...a, sheep: penned }));
  });
});

const SMALL_FIELD_ARB = fc
  .array(fc.constantFrom('.', '.', '.', '#', 's', 'w'), { minLength: 24, maxLength: 24 })
  .map((signs): Field => {
    const text = `o${signs.join('')}`;
    return parseField([0, 5, 10, 15, 20].map((start) => text.slice(start, start + 5)));
  });

const GOLDEN_FIELD = ['.#s...#', '..##..#', '..##..w', '.......', '....s..', '.......', '..#..o.'];

const GOLDEN_SEARCH_LINE = { par: 3, line: ['down', 'right', 'down'] };
