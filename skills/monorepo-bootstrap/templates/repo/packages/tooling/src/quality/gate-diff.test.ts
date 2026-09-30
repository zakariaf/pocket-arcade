// packages/tooling/src/quality/gate-diff.test.ts
import { diffSubset } from './gate-diff.ts';

describe('diffSubset', () => {
  it('ignores keys that only exist in the actual value', () => {
    expect(diffSubset({ max: 250 }, { max: 250, skipComments: true }, 'rule')).toStrictEqual([]);
  });

  it('reports a weakened limit with its path', () => {
    const expected = { rules: { 'max-params': [2, 3] } };
    const actual = { rules: { 'max-params': [2, 5] } };
    expect(diffSubset(expected, actual, 'eslint')).toStrictEqual([
      'eslint.rules.max-params[1]: expected 3, got 5',
    ]);
  });

  it('reports a rule whose options were removed', () => {
    expect(diffSubset([2, { max: 40 }], [2], 'rule')).toHaveLength(1);
  });

  it('reports a missing object', () => {
    expect(diffSubset({ hooks: { Stop: [] } }, undefined, 'claude')).toHaveLength(1);
  });
});
