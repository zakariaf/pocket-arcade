// apps/toggle-drop/src/rules/cups.test.ts
import { areCupsFull, cupColumns, fullCupCount } from './cups.ts';

describe('cupColumns', () => {
  it('lists the columns that hold a cup, left to right', () => {
    expect(cupColumns({ needs: [0, 2, 0, 1, 1], filled: [0, 0, 0, 0, 0] })).toStrictEqual([
      1, 3, 4,
    ]);
  });
});

describe('fullCupCount', () => {
  it('counts the cups that hold every ball they need', () => {
    expect(fullCupCount({ needs: [0, 2, 0, 1, 1], filled: [0, 1, 0, 1, 1] })).toBe(2);
  });
});

describe('areCupsFull', () => {
  // Design notes: the board is won when every cup is full.
  it('is true only when every cup holds what it needs', () => {
    expect(areCupsFull({ needs: [0, 2, 1], filled: [0, 2, 1] })).toBe(true);
    expect(areCupsFull({ needs: [0, 2, 1], filled: [0, 1, 1] })).toBe(false);
  });
});
