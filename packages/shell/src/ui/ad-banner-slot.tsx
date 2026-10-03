// packages/shell/src/ui/ad-banner-slot.tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

// Same shape as AdsPort's BannerSlotProps. ui/ is presentational and never imports services
// (the UI boundary lint rule), so the screen passes `ads.renderBanner` in.
export type BannerCallbacks = { readonly onLoaded: () => void; readonly onFailed: () => void };

export type AdBannerSlotProps = {
  readonly renderBanner: (callbacks: BannerCallbacks) => ReactNode; // ads.renderBanner
  readonly isAllowed: boolean; // shouldShowBanner(config, context, screen)
  readonly testID: string; // '<screen>.banner-ad', e.g. 'home.banner-ad'
  // The frame the slot takes once an ad has loaded (the Toybox banner band). The native banner
  // must stay mounted to load, so the band is a style on this View, never a wrapper that
  // renders nothing until an ad is there.
  readonly loadedStyle?: StyleProp<ViewStyle>;
};

// Bottom of Home, Levels and Statistics only. Zero height until an ad has loaded,
// so a failed or offline load leaves no empty box (spec S4).
export function AdBannerSlot({
  renderBanner,
  isAllowed,
  testID,
  loadedStyle,
}: AdBannerSlotProps): ReactNode {
  const [isLoaded, setIsLoaded] = useState(false);
  if (!isAllowed) return null;
  return (
    <View style={isLoaded ? [styles.shown, loadedStyle] : styles.collapsed} testID={testID}>
      {renderBanner({
        onLoaded: () => {
          setIsLoaded(true);
        },
        onFailed: () => {
          setIsLoaded(false);
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shown: { alignItems: 'center' },
  collapsed: { height: 0, overflow: 'hidden' },
});
