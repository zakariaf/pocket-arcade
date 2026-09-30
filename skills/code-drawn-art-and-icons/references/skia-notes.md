# Skia notes for code-drawn art

## Contents

- Versions
- Three places Skia runs
- Headless Skia in Node
- Drawing APIs used here
- Declarative drawing in components
- Jest: unit vs golden
- Fonts in Skia
- Sprites: pre-render once, invalidate on theme change

## Versions

`@shopify/react-native-skia` 2.6.2 (Expo SDK 57 pin), Reanimated 4.5.1, Node 22.18 or newer for scripts (TypeScript type stripping).

## Three places Skia runs

| Where | How Skia is loaded | Used for |
|---|---|---|
| The app | `import { Skia, Canvas, ... } from '@shopify/react-native-skia'` | the icon rasterizer, `LogoTile`, pictures, boards |
| Jest golden project | `testEnvironment: '@shopify/react-native-skia/jestEnv.js'`, `setupFilesAfterEnv: ['@shopify/react-native-skia/jestSetup.js']` (CanvasKit) | `*.golden.test.ts`: the rasterizer, `drawLogoTile`, the sprite cache |
| Node scripts | `loadHeadlessSkia()` in `packages/tooling/src/visual/load-headless-skia.ts` | `build-icon-paths.ts`, `render-icon-sheet.ts`, `render-art.ts` |

Draw code shared by all three (`draw-logo.ts`, `logo-art.ts`, `picture-ops.ts`) imports Skia **types only** and takes the Skia API as a parameter (`type SkiaApi = typeof Skia`), so Node's type stripping loads none of React Native.

## Headless Skia in Node

```ts
import headless from '@shopify/react-native-skia/lib/commonjs/headless/index.js';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb.js';
await LoadSkiaWeb();
const skia = headless.getSkiaExports().Skia;
```

Skia has no `exports` map, so deep imports need the `.js` extension under Node ESM. The CommonJS build declares its own copy of the Skia types; when passing the headless API to shared draw code, cast once: `(await loadHeadlessSkia()) as unknown as SkiaApi`.

## Drawing APIs used here

- Surfaces: `skia.Surface.Make(w, h)` (CPU), `surface.getCanvas()`, `surface.flush()`, `surface.makeImageSnapshot().encodeToBytes()` (PNG) or `.encodeToBase64()`; `.makeNonTextureImage()` for an image the UI thread can share (may return null: check it).
- Paths: `skia.Path.MakeFromSVGString(d)` (null on bad data), `skia.Path.Stroke(path, { width, cap, join })`, `skia.Path.MakeFromOp(a, b, op)`, `skia.Path.AsWinding(path)`, `skia.PathBuilder.MakeFromPath(path).setFillType(type).build()`, `path.toSVGString()`.
- Paint: `skia.Paint()`, `setColor(skia.Color(hex))`, `setAntiAlias(true)`, `setStyle(0 fill | 1 stroke)`, `setStrokeWidth`, `setStrokeCap(0 butt | 1 round)`, `setStrokeJoin(1 round)`, `setColorFilter(skia.ColorFilter.MakeMatrix(m))`.
- Canvas: `drawColor`, `clear`, `drawPath`, `drawRRect(skia.RRectXY(skia.XYWHRect(x, y, w, h), rx, ry), paint)`, `save`/`restore`, `translate`, `scale`, `rotate(deg, px, py)`, `saveLayer(paint)`.

## Declarative drawing in components

```tsx
<Canvas style={{ width, height }}>
  <Group transform={[{ scale }]}>
    <Path path={d} color={color} style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round">
      <DashPathEffect intervals={[5, 5]} />
    </Path>
    <Group transform={[{ rotate: radians }]} origin={{ x: cx, y: cy }}>...</Group>
  </Group>
</Canvas>
```

Rotations in `transform` are radians. Build element lists with a plain function (`picturePath(op, key)`), not a nested component: the lint allows one component per file.

## Jest

- The **unit** project cannot load Skia's JSI module. The root setup mocks the icon rasterizer; a test of a component with a `<Canvas>` mocks the package with inert host components (`Canvas: 'SkiaCanvas'`, `Group`, `Path`, `DashPathEffect`) and asserts the frame, size and accessibility, not pixels. Canvas-holding components are hidden from accessibility, so query them with `{ includeHiddenElements: true }`.
- The **golden** project (`*.golden.test.ts`) runs real CanvasKit: read pixels with `surface.makeImageSnapshot().readPixels()` and assert colours at known points, or compare PNGs with the board pixel-golden matcher.

## Fonts in Skia

Icons, logos and the app icon contain no text, so the art scripts load no fonts. Boards or art that draw Latin text use the bundled Toybox fonts: on the device `Skia.FontMgr.System().matchFamilyStyle('Lilita One', ...)` (or `'Rubik'`, `'Vazirmatn'`: the `expo-font` plugin embeds them and the system font manager sees them); in goldens and Node scripts `Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes))` with the TTF from `apps/<game>/assets/fonts/`, registered in a `Skia.TypefaceFontProvider` for paragraphs. Arabic-script paragraphs use `heightMultiplier: 1.5`.

## Sprites

Board sprites drawn in code are pre-rendered once per theme into one image (`packages/shell/src/game-host/sprite-cache.ts`), then blitted with `canvas.drawImageRect(sheet.image, rect, dest, paint)` or, for hundreds, `<Atlas image={sheet.image} sprites={...} transforms={...} />` with `useRSXformBuffer`.

- One cache per app (composition root): `createSpriteCache(Skia)`.
- The Game screen calls `sheetFor({ key, sprites, cellPt, pixelRatio: PixelRatio.get() })`.
- The key holds everything that changes pixels: palette id, scheme, colour-blind flag, cell size and pixel ratio (`'line-siege:dark:cb0:44@3'`). A new key disposes the old image and builds a new sheet, so a theme change never shows stale colours and a rotation that changes the cell size rebuilds.
- `makeNonTextureImage()` turns the GPU snapshot into a CPU-backed image that can be shared with the UI thread.
