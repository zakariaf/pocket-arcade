// apps/flock-tilt/src/rules/field-status.test.ts
import { fieldStatus, hasAnyTilt } from './field-status.ts';
import { parseField } from './field-text.ts';

import type { Sheep } from './flock-tilt-types.ts';

const FIELD = parseField(['s...o', '.....', 'w....']);

function withSheep(sheep: readonly Sheep[], tilts = 0) {
  return { ...FIELD, sheep, tilts, tiltLimit: 40 };
}

describe('fieldStatus', () => {
  it('says playing while a sheep is still on the field and tilts are left', () => {
    expect(fieldStatus(withSheep(FIELD.sheep))).toBe('playing');
  });

  it('says won once every sheep is in the pen', () => {
    expect(fieldStatus(withSheep([{ id: 0, cell: 4, status: 'penned' }], 3))).toBe('won');
  });

  it('says won when the last sheep drops in on the last tilt of the budget', () => {
    expect(fieldStatus(withSheep([{ id: 0, cell: 4, status: 'penned' }], 40))).toBe('won');
  });

  it('says wolf-got-sheep when a sheep is lost (spec S7: "The wolf got a sheep")', () => {
    expect(fieldStatus(withSheep([{ id: 0, cell: 13, status: 'lost' }], 2))).toBe('wolf-got-sheep');
  });

  it('says wolf-got-sheep before out-of-tilts when both happen on the last tilt', () => {
    expect(fieldStatus(withSheep([{ id: 0, cell: 13, status: 'lost' }], 40))).toBe(
      'wolf-got-sheep',
    );
  });

  it('says out-of-tilts once the tilt budget is spent', () => {
    expect(fieldStatus(withSheep(FIELD.sheep, 40))).toBe('out-of-tilts');
    expect(fieldStatus(withSheep(FIELD.sheep, 39))).toBe('playing');
  });

  it('says out-of-tilts when no tilt can move any animal', () => {
    const jammed = parseField(['s#..o', '#....', '....w']);
    expect(fieldStatus({ ...jammed, tilts: 0, tiltLimit: 40 })).toBe('playing');
    const boxed = parseField(['s#..o', '#...#', '...#w']);
    expect(fieldStatus({ ...boxed, tilts: 0, tiltLimit: 40 })).toBe('out-of-tilts');
  });
});

describe('hasAnyTilt', () => {
  it('is true when some tilt moves an animal and false when every animal is boxed in', () => {
    expect(hasAnyTilt(FIELD)).toBe(true);
    expect(hasAnyTilt(parseField(['s#..o', '#...#', '...#w']))).toBe(false);
  });
});
