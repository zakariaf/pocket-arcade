// packages/shell/src/ui/ad-banner-slot.test.tsx
// no-shell-context: the banner slot takes everything through props; the ads SDK is the root mock.
import { act, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { AdBannerSlot } from './ad-banner-slot.tsx';

import type { BannerCallbacks } from './ad-banner-slot.tsx';
import type { ReactNode } from 'react';

function captureCallbacks(): {
  readonly renderBanner: (callbacks: BannerCallbacks) => ReactNode;
  readonly latest: () => BannerCallbacks;
} {
  const seen: BannerCallbacks[] = [];
  return {
    renderBanner: (callbacks) => {
      seen.push(callbacks);
      return <View testID="fake.banner" />;
    },
    latest: () => {
      const last = seen.at(-1);
      if (last === undefined) throw new Error('the banner was never rendered');
      return last;
    },
  };
}

describe('AdBannerSlot', () => {
  it('renders nothing when the policy forbids a banner', async () => {
    const banner = captureCallbacks();
    await render(
      <AdBannerSlot renderBanner={banner.renderBanner} isAllowed={false} testID="home.banner-ad" />,
    );
    expect(screen.queryByTestId('home.banner-ad')).toBeNull();
  });

  it('stays collapsed until the banner has loaded', async () => {
    const banner = captureCallbacks();
    await render(
      <AdBannerSlot renderBanner={banner.renderBanner} isAllowed testID="home.banner-ad" />,
    );
    expect(screen.getByTestId('home.banner-ad')).toHaveStyle({ height: 0 });
    await act(() => {
      banner.latest().onLoaded();
    });
    expect(screen.getByTestId('home.banner-ad')).not.toHaveStyle({ height: 0 });
  });

  it('takes the band style only once an ad has loaded', async () => {
    const banner = captureCallbacks();
    const band = { paddingBlock: 6, borderTopWidth: 2 };
    await render(
      <AdBannerSlot
        renderBanner={banner.renderBanner}
        isAllowed
        testID="levels.banner-ad"
        loadedStyle={band}
      />,
    );
    expect(screen.getByTestId('levels.banner-ad')).not.toHaveStyle(band);
    await act(() => {
      banner.latest().onLoaded();
    });
    expect(screen.getByTestId('levels.banner-ad')).toHaveStyle(band);
    expect(screen.getByTestId('fake.banner')).toBeOnTheScreen();
  });

  it('collapses again after a failed load, without any message', async () => {
    const banner = captureCallbacks();
    await render(
      <AdBannerSlot renderBanner={banner.renderBanner} isAllowed testID="stats.banner-ad" />,
    );
    await act(() => {
      banner.latest().onLoaded();
    });
    await act(() => {
      banner.latest().onFailed();
    });
    expect(screen.getByTestId('stats.banner-ad')).toHaveStyle({ height: 0 });
  });
});
