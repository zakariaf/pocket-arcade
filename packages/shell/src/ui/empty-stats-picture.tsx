// packages/shell/src/ui/empty-stats-picture.tsx
import { Canvas, Group } from '@shopify/react-native-skia';

import { EMPTY_STATS_VIEWBOX, emptyStatsOps } from '@e07/shell/art/picture-ops.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { picturePath } from './picture-path.tsx';

import type { ReactNode } from 'react';

export type EmptyStatsPictureProps = {
  /** Width in pt; the picture keeps its 190 x 150 proportions. Default 190. */
  readonly width?: number;
  readonly testID?: string;
};

/** S10 empty state: a toy box waiting for its first star. Decorative (the title says it). */
export function EmptyStatsPicture({
  width = EMPTY_STATS_VIEWBOX.width,
  testID,
}: EmptyStatsPictureProps): ReactNode {
  const theme = useTheme();
  const shell = SHELL_COLORS[theme.scheme];
  const scale = width / EMPTY_STATS_VIEWBOX.width;
  const height = EMPTY_STATS_VIEWBOX.height * scale;
  const ops = emptyStatsOps(theme.colors, { toyInk: shell.toyInk, white: shell.cut });
  return (
    <Canvas
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
    >
      <Group transform={[{ scale }]}>
        {ops.map((op, index) => picturePath(op, `${String(index)}-${op.style}`))}
      </Group>
    </Canvas>
  );
}
