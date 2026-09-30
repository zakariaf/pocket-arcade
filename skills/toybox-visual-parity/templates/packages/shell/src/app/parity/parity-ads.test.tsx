// packages/shell/src/app/parity/parity-ads.test.tsx
import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { createParityAds, parityForcedPlacements } from './parity-ads.tsx';

describe('createParityAds', () => {
  it('draws a 320 x 50 stand-in banner that reports itself loaded once', async () => {
    const onLoaded = jest.fn();
    const onFailed = jest.fn();
    const ads = createParityAds();

    await renderWithShell(<>{ads.renderBanner({ onLoaded, onFailed })}</>);

    // allow-style-assertion: the stand-in's 320 x 50 size is the banner slot the design frame measures.
    expect(screen.getByTestId('parity.banner-stand-in')).toHaveStyle({ width: 320, height: 50 });
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('calls no ad SDK and has a rewarded ad ready (S7 draws the offer)', async () => {
    const ads = createParityAds();

    await expect(ads.initialize()).resolves.toBeUndefined();
    expect(ads.isRewardedLoaded()).toBe(true);
    await expect(ads.showInterstitial()).resolves.toBe('unavailable');
    await expect(ads.showRewarded()).resolves.toBe('unavailable');
  });
});

describe('parityForcedPlacements', () => {
  it('opens the three banner slots and the Result offer unless the frame is Premium', () => {
    expect(parityForcedPlacements({ premium: false })).toStrictEqual([
      'home',
      'levels',
      'stats',
      'result',
    ]);
    expect(parityForcedPlacements({ premium: true })).toStrictEqual([]);
  });
});
