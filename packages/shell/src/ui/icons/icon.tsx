// packages/shell/src/ui/icons/icon.tsx
import { Image, PixelRatio, StyleSheet } from 'react-native';

import { useDirection } from '@e07/shell/i18n/direction-context.tsx';

import { DIRECTIONAL_ICONS } from './icon-paths.ts';
import { getIconUri } from './icon-raster.ts';

import type { IconName } from './icon-paths.ts';
import type { ReactNode } from 'react';

export type IconProps = {
  readonly name: IconName;
  readonly color: string;
  readonly size?: number;
  /** Part id for parity checks, e.g. `pause.sound-switch.icon`. */
  readonly testID?: string;
};

const styles = StyleSheet.create({ flipped: { transform: [{ scaleX: -1 }] } });

/** Decorative: the button or row around an icon carries the accessibility label. */
export function Icon({ name, color, size = 24, testID }: IconProps): ReactNode {
  const direction = useDirection();
  const isFlipped = direction === 'rtl' && DIRECTIONAL_ICONS.has(name);
  return (
    <Image
      source={{ uri: getIconUri(name, size, PixelRatio.get()), width: size, height: size }}
      tintColor={color}
      style={[{ width: size, height: size }, isFlipped && styles.flipped]}
      {...(testID === undefined ? {} : { testID })}
    />
  );
}
