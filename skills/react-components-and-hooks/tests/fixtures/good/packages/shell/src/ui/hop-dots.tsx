import { View } from 'react-native';

import type { ReactNode } from 'react';

/** Three fixed blocks: the list is constant data, so its values are stable keys. */
const DOTS = [0, 1, 2] as const;

export function HopDots(): ReactNode {
  return (
    <View>
      {DOTS.map((index) => (
        <View key={index} />
      ))}
    </View>
  );
}
