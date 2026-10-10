// packages/shell/src/screens/settings/settings-row-specs.test.ts
import { SETTINGS_ROW_SPECS } from './settings-row-specs.ts';

describe('SETTINGS_ROW_SPECS', () => {
  it('draws Rate this game with the hollow rating star, as the design (star(false), 1.8 edge)', () => {
    expect(SETTINGS_ROW_SPECS.rate.icon).toBe('rating-star-hollow');
  });
});
