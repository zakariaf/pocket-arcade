// packages/shell/src/feature/feature.test.ts
import { featureValue } from './feature.ts';

describe('featureValue', () => {
  it('adds one to the core', () => {
    expect(featureValue()).toBe(3);
  });
});
