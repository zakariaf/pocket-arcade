// packages/shell/src/ui/icons/icon-raster.ts
import { Skia } from '@shopify/react-native-skia';

const fill = Skia.Paint();
fill.setAntiAlias(true);

/** The shared icon paint. */
export function iconPaint(): unknown {
  return fill;
}
