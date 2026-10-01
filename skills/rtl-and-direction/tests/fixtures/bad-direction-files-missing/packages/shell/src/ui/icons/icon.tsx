import { Image, StyleSheet } from 'react-native';

import { useDirection } from '@e07/shell/i18n/direction-context.tsx';

import { DIRECTIONAL_ICONS } from './icon-paths.ts';

import type { IconName } from './icon-paths.ts';
import type { ReactNode } from 'react';

const styles = StyleSheet.create({ flipped: { transform: [{ scaleX: -1 }] } });

export function Icon({ name, uri }: { readonly name: IconName; readonly uri: string }): ReactNode {
  const isFlipped = useDirection() === 'rtl' && DIRECTIONAL_ICONS.has(name);
  return <Image source={{ uri }} style={[{ width: 24, height: 24 }, isFlipped && styles.flipped]} />;
}
