// packages/shell/src/ui/icons/icon-raster.ts
import { Skia } from '@shopify/react-native-skia';

import { ICON_PATHS } from './icon-paths.ts';

import type { IconName } from './icon-paths.ts';

const GRID = 24;
const cache = new Map<string, string>();
const fill = Skia.Paint();
fill.setColor(Skia.Color('#FFFFFF'));
fill.setAntiAlias(true);

function rasterize(svgPath: string, px: number): string {
  const surface = Skia.Surface.Make(px, px);
  const path = Skia.Path.MakeFromSVGString(svgPath);
  if (surface === null || path === null) throw new Error('Icon rasterization failed');
  const canvas = surface.getCanvas();
  canvas.scale(px / GRID, px / GRID);
  canvas.drawPath(path, fill);
  surface.flush();
  return `data:image/png;base64,${surface.makeImageSnapshot().encodeToBase64()}`;
}

/** A white PNG (tinted later by <Image tintColor>) per icon and pixel size, cached forever. */
export function getIconUri(name: IconName, sizePt: number, pixelRatio: number): string {
  const px = Math.ceil(sizePt * pixelRatio);
  const key = `${name}@${String(px)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const uri = rasterize(ICON_PATHS[name], px);
  cache.set(key, uri);
  return uri;
}
