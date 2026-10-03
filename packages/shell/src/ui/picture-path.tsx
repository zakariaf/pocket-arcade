// packages/shell/src/ui/picture-path.tsx
import { DashPathEffect, Group, Path } from '@shopify/react-native-skia';

import type { PictureOp } from '@e07/shell/art/picture-ops.ts';
import type { ReactNode } from 'react';

/** One picture paint operation as Skia elements (a plain function, used inside a <Canvas>). */
export function picturePath(op: PictureOp, key: string): ReactNode {
  const path = (
    <Path
      key={key}
      path={op.d}
      color={op.color}
      style={op.style}
      strokeWidth={op.width}
      strokeCap={op.cap}
      strokeJoin={op.join}
    >
      {op.dash === undefined ? null : <DashPathEffect intervals={[...op.dash]} />}
    </Path>
  );
  if (op.rotate === undefined) return path;
  return (
    <Group
      key={key}
      transform={[{ rotate: (op.rotate.deg * Math.PI) / 180 }]}
      origin={{ x: op.rotate.cx, y: op.rotate.cy }}
    >
      {path}
    </Group>
  );
}
