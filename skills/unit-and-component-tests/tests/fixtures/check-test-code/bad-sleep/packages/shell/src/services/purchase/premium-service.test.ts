import { startPremium } from './premium-store-flow.ts';

describe('startPremium', () => {
  it('connects', async () => {
    const calls: string[] = [];
    void startPremium({ calls });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toStrictEqual(['connect']);
  });
});
