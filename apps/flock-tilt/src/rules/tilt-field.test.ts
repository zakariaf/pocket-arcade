// apps/flock-tilt/src/rules/tilt-field.test.ts
import fc from 'fast-check';

import { fieldText, parseField } from './field-text.ts';
import { DIRECTIONS, stepFrom, tiltField } from './tilt-field.ts';

import type { Direction, Field } from './flock-tilt-types.ts';

/** The map after one tilt (penned sheep leave the map, lost ones show as x). */
function tilted(lines: readonly string[], direction: Direction): string {
  const field = parseField(lines);
  return fieldText({ ...field, ...tiltField(field, direction) });
}

const SIGN_ARB = fc.constantFrom('.', '.', '.', '#', 's', 'w');

/** Random 5 x 5 fields with the pen in the top-left corner. */
const FIELD_ARB = fc
  .array(fc.array(SIGN_ARB, { minLength: 5, maxLength: 5 }), { minLength: 5, maxLength: 5 })
  .map((rows) => rows.map((row) => row.join('')))
  .map((rows): Field => parseField([`o${rows[0]?.slice(1) ?? ''}`, ...rows.slice(1)]));

const DIRECTION_ARB = fc.constantFrom<Direction>(...DIRECTIONS);

function idsOf(animals: readonly { readonly id: number }[]): number[] {
  return animals.map((animal) => animal.id);
}

/** Cells still occupied after a tilt: sheep not in the pen, and every wolf. */
function standingCells(result: ReturnType<typeof tiltField>): number[] {
  const sheep = result.sheep.filter((one) => one.status !== 'penned');
  return [...sheep.map((one) => one.cell), ...result.wolves.map((wolf) => wolf.cell)];
}

function checkTiltInvariants(field: Field, direction: Direction): void {
  const frozen = structuredClone(field);
  const result = tiltField(field, direction);
  expect(field).toStrictEqual(frozen);
  expect(idsOf(result.sheep)).toStrictEqual(idsOf(field.sheep));
  expect(idsOf(result.wolves)).toStrictEqual(idsOf(field.wolves));
  const standing = standingCells(result);
  expect(new Set(standing).size).toBe(standing.length);
  const blocked = standing.filter((cell) => field.rocks.includes(cell) || cell === field.pen);
  expect(blocked).toStrictEqual([]);
}

describe('stepFrom', () => {
  it('steps one cell in each physical direction and returns -1 past the fence', () => {
    const field = { cols: 3, rows: 3 };
    expect(DIRECTIONS.map((direction) => stepFrom(field, 4, direction))).toStrictEqual([
      1, 5, 7, 3,
    ]);
    expect(DIRECTIONS.map((direction) => stepFrom(field, 0, direction))).toStrictEqual([
      -1, 1, 3, -1,
    ]);
    expect(DIRECTIONS.map((direction) => stepFrom(field, 8, direction))).toStrictEqual([
      5, -1, -1, 7,
    ]);
  });
});

describe('tiltField (spec 13: "everything slides until it hits something")', () => {
  it('slides a sheep to the fence', () => {
    expect(tilted(['s...o'], 'left')).toBe('s...o');
    expect(tilted(['o...s', '.....'], 'down')).toBe(['o....', '....s'].join('\n'));
  });

  it('moves the animal nearest the fence first, so the flock piles up behind it', () => {
    const field = parseField(['ss..o', '.....']);
    const result = tiltField(field, 'down');
    expect(fieldText({ ...field, ...result })).toBe(['....o', 'ss...'].join('\n'));
    const piled = parseField(['.....', 'ss..o']);
    const right = tiltField(parseField(['.ss..', '....o']), 'right');
    expect(right.slides).toStrictEqual([
      { animal: 'sheep', id: 1, from: 2, to: 4, stoppedBy: 'fence' },
      { animal: 'sheep', id: 0, from: 1, to: 3, stoppedBy: 'sheep' },
    ]);
    expect(tiltField(piled, 'left').slides).toStrictEqual([]);
  });

  it('stops animals at rocks', () => {
    expect(tilted(['s..#.', 'o....'], 'right')).toBe(['..s#.', 'o....'].join('\n'));
    expect(tiltField(parseField(['s..#.', 'o....']), 'right').slides).toStrictEqual([
      { animal: 'sheep', id: 0, from: 0, to: 2, stoppedBy: 'rock' },
    ]);
  });

  it('drops a sheep that reaches the pen into it, and the sheep behind follow', () => {
    const result = tiltField(parseField(['ss.o.']), 'right');
    expect(result.penned).toStrictEqual([1, 0]);
    expect(result.sheep).toStrictEqual([
      { id: 0, cell: 3, status: 'penned' },
      { id: 1, cell: 3, status: 'penned' },
    ]);
    expect(result.slides).toStrictEqual([
      { animal: 'sheep', id: 1, from: 1, to: 3, stoppedBy: 'pen' },
      { animal: 'sheep', id: 0, from: 0, to: 3, stoppedBy: 'pen' },
    ]);
  });

  it('stops a wolf in front of the pen: wolves treat it like a rock', () => {
    const result = tiltField(parseField(['w..o.', 's....']), 'right');
    expect(fieldText({ ...parseField(['w..o.', 's....']), ...result })).toBe(
      ['..wo.', '....s'].join('\n'),
    );
    expect(result.slides.find((slide) => slide.animal === 'wolf')).toStrictEqual({
      animal: 'wolf',
      id: 0,
      from: 0,
      to: 2,
      stoppedBy: 'pen',
    });
  });

  it('loses a sheep that ends against a wolf along the tilt, in front of it or behind it', () => {
    const ahead = tiltField(parseField(['s...w', 'o....']), 'right');
    expect(ahead.losses).toStrictEqual([{ sheepId: 0, cell: 3, wolfId: 0, wolfCell: 4 }]);
    expect(ahead.sheep).toStrictEqual([{ id: 0, cell: 3, status: 'lost' }]);
    const behind = tiltField(parseField(['w...s', 'o....']), 'right');
    expect(behind.losses).toStrictEqual([{ sheepId: 0, cell: 4, wolfId: 0, wolfCell: 3 }]);
  });

  it('keeps a sheep that ends beside a wolf across the tilt (the gentle wolf rule)', () => {
    const result = tiltField(parseField(['s...o', 'w....']), 'right');
    expect(result.losses).toStrictEqual([]);
    expect(fieldText({ ...parseField(['s...o', 'w....']), ...result })).toBe(
      ['....o', '....w'].join('\n'),
    );
  });

  it('moves nothing when every animal is already against something', () => {
    const result = tiltField(parseField(['#s..o', '.....']), 'left');
    expect(result.slides).toStrictEqual([]);
    expect(result.penned).toStrictEqual([]);
  });

  describe('properties', () => {
    it('leaves its input unchanged, keeps every animal and puts no two on one cell or a rock', () => {
      fc.assert(fc.property(FIELD_ARB, DIRECTION_ARB, checkTiltInvariants));
    });

    it('gives the same tilt twice for the same field (no hidden state)', () => {
      fc.assert(
        fc.property(FIELD_ARB, DIRECTION_ARB, (field, direction) => {
          expect(tiltField(field, direction)).toStrictEqual(tiltField(field, direction));
        }),
      );
    });
  });
});
