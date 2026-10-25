// apps/flock-tilt/src/rules/field-text.test.ts
import { fieldText, parseField } from './field-text.ts';

describe('parseField', () => {
  it('reads rocks, the pen, sheep and wolves from a text map, ids in reading order', () => {
    expect(parseField(['s.#', 'w.o', '.s.'])).toStrictEqual({
      cols: 3,
      rows: 3,
      rocks: [2],
      pen: 5,
      sheep: [
        { id: 0, cell: 0, status: 'field' },
        { id: 1, cell: 7, status: 'field' },
      ],
      wolves: [{ id: 0, cell: 3 }],
    });
  });

  it('refuses a map without exactly one pen or with an unknown sign', () => {
    expect(() => parseField([])).toThrow(RangeError);
    expect(() => parseField(['s..', '...'])).toThrow(RangeError);
    expect(() => parseField(['o.o'])).toThrow(RangeError);
    expect(() => parseField(['o.?'])).toThrow(RangeError);
  });

  it('refuses rows of different lengths', () => {
    expect(() => parseField(['o..', '..'])).toThrow(RangeError);
  });
});

describe('fieldText', () => {
  it('draws a parsed map back unchanged', () => {
    const lines = ['s.#.', 'w.o.', '.s.w'];
    expect(fieldText(parseField(lines))).toBe(lines.join('\n'));
  });

  it('draws a lost sheep as x and leaves penned sheep off the map', () => {
    const field = parseField(['s.o', 's.w']);
    const sheep = [
      { id: 0, cell: 2, status: 'penned' as const },
      { id: 1, cell: 3, status: 'lost' as const },
    ];
    expect(fieldText({ ...field, sheep })).toBe(['..o', 'x.w'].join('\n'));
  });
});
