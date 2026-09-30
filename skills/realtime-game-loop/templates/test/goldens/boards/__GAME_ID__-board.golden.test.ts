// test/goldens/boards/__GAME_ID__-board.golden.test.ts
// PIXEL GOLDEN of a real-time board (Jest 'golden' project, CanvasKit): the SAME drawArena() the
// device runs, on a sim stepped by a scripted bot to fixed ticks. It lives under test/ with the
// other board goldens; tolerance and diff folder come from skia-golden.ts. Create or change
// baselines only with `npx jest <this file> --selectProjects golden -u`, after looking at every
// PNG, and commit with a `Gate-Change:` trailer.
import { Skia } from '@shopify/react-native-skia';

import { BOARD_PALETTES } from '@e07/__GAME_ID__/board/board-palettes.ts';
import { drawArena } from '@e07/__GAME_ID__/board/draw-arena.ts';
import { create__GAME_PASCAL__Sim, step__GAME_PASCAL__Sim } from '@e07/__GAME_ID__/sim/__GAME_ID__-sim.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintSimPng } from '@e07/shell/game-host/paint-sim-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { __GAME_PASCAL__Sim } from '@e07/__GAME_ID__/sim/__GAME_ID__-sim.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

const KIT = makeBoardKit(Skia, { paths: {}, numberTypeface: null, numberSize: 16 });
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
/** Moments of the scripted run: 0, 50 % and 100 % of RUN_TICKS (120 ticks = 1 s). */
const MOMENTS = [0, 0.5, 1] as const;
const RUN_TICKS = 240;
const SEED = 7;
const ENTITIES = 20;

/** The same seed and bot always give the same world, so the pictures are stable. */
function simAt(ticks: number): __GAME_PASCAL__Sim {
  const sim = create__GAME_PASCAL__Sim(SEED, ENTITIES);
  for (let tick = 0; tick < ticks; tick += 1) step__GAME_PASCAL__Sim(sim, ((tick >> 5) % 16) + 1);
  return sim;
}

describe('__GAME_ID__ board goldens', () => {
  it.each(SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment }))))(
    'renders $name at $moment of a scripted run',
    ({ width, height, moment, name }) => {
      const png = paintSimPng(Skia, {
        draw: drawArena,
        sim: simAt(Math.round(RUN_TICKS * moment)),
        width,
        height,
        colors: COLORS,
        kit: KIT,
      });
      expect(Buffer.from(png)).toMatchImageSnapshot({
        customSnapshotIdentifier: `__GAME_ID__-${name}-${String(moment)}`,
      });
    },
  );
});
