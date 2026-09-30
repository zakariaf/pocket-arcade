// packages/shell/src/services/ads/fullscreen-ad.test.ts
import { runFullscreenAd } from './fullscreen-ad.ts';

import type { GameLifecycle } from './fullscreen-ad.ts';

function recordingLifecycle(): { readonly lifecycle: GameLifecycle; readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    lifecycle: {
      suspend: (reason) => calls.push(`suspend:${reason}`),
      resume: (reason) => calls.push(`resume:${reason}`),
    },
  };
}

describe('runFullscreenAd', () => {
  it('pauses the game around the ad and returns its result', async () => {
    const { lifecycle, calls } = recordingLifecycle();

    await expect(
      runFullscreenAd(lifecycle, () => {
        calls.push('show');
        return Promise.resolve('shown');
      }),
    ).resolves.toBe('shown');
    expect(calls).toStrictEqual(['suspend:fullscreen-ad', 'show', 'resume:fullscreen-ad']);
  });

  it('resumes the game even when the ad fails', async () => {
    const { lifecycle, calls } = recordingLifecycle();

    await expect(
      runFullscreenAd(lifecycle, () => Promise.reject(new Error('no fill'))),
    ).rejects.toThrow('no fill');
    expect(calls).toStrictEqual(['suspend:fullscreen-ad', 'resume:fullscreen-ad']);
  });
});
