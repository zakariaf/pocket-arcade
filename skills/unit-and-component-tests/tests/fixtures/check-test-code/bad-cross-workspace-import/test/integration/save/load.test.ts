import { planLoad } from '../../../packages/shell/src/services/save/load-plan.ts';

describe('planLoad', () => {
  it('starts fresh without slots', () => {
    expect(planLoad({ current: null, backup: null, gameId: 'demo' }).kind).toBe('fresh');
  });
});
