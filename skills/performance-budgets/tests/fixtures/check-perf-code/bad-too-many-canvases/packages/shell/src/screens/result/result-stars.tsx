import { Canvas } from '@shopify/react-native-skia';
import { View } from 'react-native';

import type { ReactNode } from 'react';

export function ResultStars(): ReactNode {
  return (
    <View>
      <Canvas style={{ width: 40, height: 40 }} />
      <Canvas style={{ width: 40, height: 40 }} />
      <Canvas style={{ width: 40, height: 40 }} />
      <Canvas style={{ width: 40, height: 40 }} />
      <Canvas style={{ width: 40, height: 40 }} />
      <Canvas style={{ width: 40, height: 40 }} />
      <Canvas style={{ width: 40, height: 40 }} />
      <Canvas style={{ width: 40, height: 40 }} />
      <Canvas style={{ width: 40, height: 40 }} />
    </View>
  );
}
