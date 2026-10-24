// test/goldens/boards/golden-font.ts
// The board's digits face for the pixel goldens, made the device's way (board-number-typeface.ts):
// from the bytes of the font the app bundles, here read from its assets folder with node:fs
// instead of the BoardFont native module. It sits next to the gated matcher (skia-golden.ts), not
// inside it, so a golden's font is never a gate change.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { boardNumberTypefaceOf } from '@e07/shell/game-host/board-number-typeface.ts';

import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkTypeface } from '@shopify/react-native-skia';

/** The digits face of a game's board, from apps/<gameId>/assets/fonts. */
export function goldenNumberTypeface(skia: SkiaApi, gameId: string): SkTypeface | null {
  const fonts = join(process.cwd(), 'apps', gameId, 'assets', 'fonts');
  return boardNumberTypefaceOf(skia, (fileName) =>
    Uint8Array.from(readFileSync(join(fonts, fileName))),
  );
}
