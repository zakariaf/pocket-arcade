// packages/tooling/src/visual/load-headless-skia.ts — the Skia API for plain Node (CanvasKit, no simulator).
// Draw modules (boards, logos, icons) import only TYPES from '@shopify/react-native-skia' and take the
// Skia API as a parameter, so Node's type stripping loads none of React Native.
import headless from '@shopify/react-native-skia/lib/commonjs/headless/index.js';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb.js';

export type HeadlessSkia = ReturnType<typeof headless.getSkiaExports>['Skia'];

export async function loadHeadlessSkia(): Promise<HeadlessSkia> {
  await LoadSkiaWeb();
  return headless.getSkiaExports().Skia;
}
