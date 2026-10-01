// packages/shell/src/core/util.test.ts
import { double } from './util.ts';

describe('double', () => {
  it('doubles', () => {
    expect(double(2)).toBe(4);
  });
});
