// packages/shell/src/game-host/sprite-cache.ts
// Sprites drawn in code are pre-rendered ONCE per theme into one image, then blitted with
// drawImageRect or <Atlas>. The cache key covers everything that changes the pixels.
import type { SkiaApi } from './board-types.ts';
import type { SkCanvas, SkImage, SkRect } from '@shopify/react-native-skia';

export type SpriteSpec = {
  readonly id: string;
  /** Draws the sprite into a size x size cell whose origin is the canvas origin. */
  readonly draw: (canvas: SkCanvas, size: number) => void;
};

export type SpriteSheetInput = {
  /** paletteId + scheme + colour-blind + cell size + pixel ratio, e.g. 'line-siege:dark:cb0:44@3'. */
  readonly key: string;
  readonly sprites: readonly SpriteSpec[];
  /** Cell size in points and the device pixel ratio (PixelRatio.get()). */
  readonly cellPt: number;
  readonly pixelRatio: number;
};

export type SpriteSheet = {
  readonly key: string;
  readonly image: SkImage;
  /** Source rectangle of each sprite in image pixels. */
  readonly rects: Readonly<Partial<Record<string, SkRect>>>;
  readonly cellPx: number;
};

export type SpriteCache = { readonly sheetFor: (input: SpriteSheetInput) => SpriteSheet };

/** Renders all sprites side by side into one CPU-backed image (safe to share with the UI thread). */
export function buildSpriteSheet(skia: SkiaApi, input: SpriteSheetInput): SpriteSheet {
  const cellPx = Math.round(input.cellPt * input.pixelRatio);
  const surface = skia.Surface.MakeOffscreen(cellPx * input.sprites.length, cellPx);
  if (surface === null) throw new Error('Offscreen surface unavailable');
  // The sheet keeps only its CPU image: the surface and its GPU snapshot are freed even when a
  // sprite's draw throws.
  try {
    const rects = drawSprites(surface.getCanvas(), input.sprites, cellPx);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    const image = snapshot.makeNonTextureImage();
    snapshot.dispose();
    if (image === null) throw new Error('Sprite sheet snapshot failed');
    return { key: input.key, image, rects, cellPx };
  } finally {
    surface.dispose();
  }
}

function drawSprites(
  canvas: SkCanvas,
  sprites: readonly SpriteSpec[],
  cellPx: number,
): Partial<Record<string, SkRect>> {
  const rects: Partial<Record<string, SkRect>> = {};
  sprites.forEach((sprite, index) => {
    canvas.save();
    canvas.translate(index * cellPx, 0);
    sprite.draw(canvas, cellPx);
    canvas.restore();
    rects[sprite.id] = { x: index * cellPx, y: 0, width: cellPx, height: cellPx };
  });
  return rects;
}

/**
 * One cache per app (composition root). A new key builds the new sheet first and only then
 * disposes the old image, so a build that throws leaves the current sheet in place and usable.
 */
export function createSpriteCache(skia: SkiaApi): SpriteCache {
  let current: SpriteSheet | null = null;
  return {
    sheetFor: (input) => {
      if (current?.key === input.key) return current;
      const next = buildSpriteSheet(skia, input);
      current?.image.dispose();
      current = next;
      return current;
    },
  };
}
