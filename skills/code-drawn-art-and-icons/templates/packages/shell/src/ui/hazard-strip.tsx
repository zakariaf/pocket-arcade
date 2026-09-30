// packages/shell/src/ui/hazard-strip.tsx
import { Canvas } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HAZARD, hazardStripeOps } from '@e07/shell/art/picture-ops.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { picturePath } from './picture-path.tsx';

import type { ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export type HazardStripProps = { readonly testID?: string };

const styles = StyleSheet.create({ strip: { height: HAZARD.height, alignSelf: 'stretch' } });

/** S15 (test builds only): gold and toy-ink stripes under the status bar. Decorative. */
export function HazardStrip({ testID }: HazardStripProps): ReactNode {
  const theme = useTheme();
  const shell = SHELL_COLORS[theme.scheme];
  const [width, setWidth] = useState(0);
  const handleLayout = (event: LayoutChangeEvent): void => {
    setWidth(event.nativeEvent.layout.width);
  };
  const ops = hazardStripeOps(width, { gold: shell.gold, toyInk: shell.toyInk });
  return (
    <View
      style={styles.strip}
      onLayout={handleLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
    >
      {width > 0 ? (
        <Canvas style={{ width, height: HAZARD.height }}>
          {ops.map((op, index) => picturePath(op, `${String(index)}-${op.style}`))}
        </Canvas>
      ) : null}
    </View>
  );
}
