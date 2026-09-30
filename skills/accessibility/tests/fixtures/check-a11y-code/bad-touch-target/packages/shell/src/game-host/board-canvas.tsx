import { Canvas } from '@shopify/react-native-skia';

import type { ReactNode } from 'react';

export function BoardCanvas({ label }: { readonly label: string }): ReactNode {
  return <Canvas style={{ flex: 1 }} accessible accessibilityRole="image" accessibilityLabel={label} />;
}
