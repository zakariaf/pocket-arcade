// packages/shell/src/game-host/fullscreen-gate.test.ts
import { runFullscreenAd } from '@e07/shell/services/ads/fullscreen-ad.ts';

import { createFullscreenGate } from './fullscreen-gate.ts';

describe('createFullscreenGate', () => {
  it('is closed while a full-screen ad shows and open again afterwards, even when it fails', async () => {
    const gate = createFullscreenGate();
    const seen: boolean[] = [];
    await runFullscreenAd(gate, () => {
      seen.push(gate.store.getState().isShowing);
      return Promise.resolve('shown');
    });
    await expect(runFullscreenAd(gate, () => Promise.reject(new Error('no fill')))).rejects.toThrow(
      'no fill',
    );
    expect(seen).toStrictEqual([true]);
    expect(gate.store.getState().isShowing).toBe(false);
  });
});
