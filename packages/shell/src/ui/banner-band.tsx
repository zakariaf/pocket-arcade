// packages/shell/src/ui/banner-band.tsx
import { View } from 'react-native';

import { useBannerBandStyle } from './use-banner-band-style.ts';

import type { ReactNode } from 'react';

export type BannerBandProps = {
  /** What the band frames. The ad banner itself never goes here: see useBannerBandStyle. */
  readonly children: ReactNode;
  /** False: the band takes no space at all. */
  readonly isVisible: boolean;
  readonly testID: string;
};

/**
 * The Toybox banner band (4.17) as a frame. The live ad banner is not wrapped in it: a banner must
 * stay mounted to load, so the screens give AdBannerSlot the same look as loadedStyle
 * (useBannerBandStyle), and the band appears only once an ad has loaded.
 */
export function BannerBand({ children, isVisible, testID }: BannerBandProps): ReactNode {
  const bandStyle = useBannerBandStyle();
  if (!isVisible) return null;
  return (
    <View style={bandStyle} testID={testID}>
      {children}
    </View>
  );
}
