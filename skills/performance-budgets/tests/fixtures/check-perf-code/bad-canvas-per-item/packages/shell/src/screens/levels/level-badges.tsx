import { Canvas } from '@shopify/react-native-skia';
import { View } from 'react-native';

import type { ReactNode } from 'react';

export function LevelBadges({ levels }: { readonly levels: readonly number[] }): ReactNode {
  return <View>{levels.map((level) => <Canvas key={level} style={{ width: 24, height: 24 }} />)}</View>;
}
