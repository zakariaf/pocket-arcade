import { Canvas } from '@shopify/react-native-skia';
import { View } from 'react-native';

import type { ReactNode } from 'react';

export function Stickers(): ReactNode {
  return (
    <View>
      <Canvas style={{ width: 10, height: 10 }} />
      <Canvas style={{ width: 10, height: 10 }} />
      <Canvas style={{ width: 10, height: 10 }} />
      <Canvas style={{ width: 10, height: 10 }} />
      <Canvas style={{ width: 10, height: 10 }} />
      <Canvas style={{ width: 10, height: 10 }} />
      <Canvas style={{ width: 10, height: 10 }} />
      <Canvas style={{ width: 10, height: 10 }} />
      <Canvas style={{ width: 10, height: 10 }} />
    </View>
  );
}
