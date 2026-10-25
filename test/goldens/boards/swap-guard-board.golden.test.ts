// test/goldens/boards/swap-guard-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It renders the board through paintBoardPng, the
// same draw() and layout() the device runs, at 3 sizes x 3 moments of the busiest turn. It reads the
// font with node:fs, so it lives under test/ (Node APIs are banned in apps/*/src). Tolerance and diff
// folder come from skia-golden.ts. Create or change the baselines only with
// `npx jest <this file> --selectProjects golden -u`, after opening every PNG, with a Gate-Change trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';
import { BOARD_PALETTES } from '@e07/swap-guard/board/board-palettes.ts';
import { buildTimeline } from '@e07/swap-guard/board/build-timeline.ts';
import { swapGuardBoard } from '@e07/swap-guard/board/swap-guard-board.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { SwapGuardView } from '@e07/swap-guard/board/to-view.ts';
import type { SwapGuardEvent } from '@e07/swap-guard/rules/swap-guard-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/swap-guard/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: swapGuardBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
/**
 * A real turn of the hardest row (seed 2, difficulty 80, the opening swap), with Persian digits:
 * the guard swaps with the brute, the spear's strike and the brute's own slam knock both out (the
 * double hit), and four enemies stand with their strikes shown again. Moment 0 shows the board
 * before the move plays (the old strikes shaded, the two fallen enemies still standing), 0.5 the
 * bursts mid-flight, 1 the final view with the new telegraph.
 */
const VIEW: SwapGuardView = {
  size: 6,
  guard: 17,
  enemies: [
    { id: 2, kind: 'spear', facing: 'left', cell: 27 },
    { id: 3, kind: 'archer', facing: 'left', cell: 20 },
    { id: 4, kind: 'archer', facing: 'right', cell: 33 },
    { id: 5, kind: 'archer', facing: 'down', cell: 31 },
  ],
  fallen: [
    { id: 0, kind: 'spear', facing: 'down', cell: 16 },
    { id: 1, kind: 'brute', facing: 'up', cell: 22 },
  ],
  marks: [
    { cell: 18, facing: 'left' },
    { cell: 19, facing: 'left' },
    { cell: 26, facing: 'left' },
    { cell: 34, facing: 'right' },
    { cell: 35, facing: 'right' },
  ],
  swapsLeftText: '۱۴',
  swapsLeft: 14,
  maxSwaps: 15,
  defeated: 2,
  total: 6,
  isHit: false,
};
const EVENTS: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 22, to: 17, enemyId: 1 },
  {
    kind: 'strikes-landed',
    strikes: [
      { enemyId: 0, cells: [22] },
      { enemyId: 1, cells: [11, 23, 16] },
      { enemyId: 2, cells: [26] },
      { enemyId: 3, cells: [19, 18] },
      { enemyId: 4, cells: [34, 35] },
    ],
  },
  { kind: 'enemies-defeated', enemyIds: [0, 1], cells: [16, 22] },
];
const TRACKS = buildTimeline(EVENTS, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('swap-guard board goldens', () => {
  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: swapGuardBoard.draw,
        layout: swapGuardBoard.layout,
        view: VIEW,
        tracks: TRACKS,
        elapsedMs: timelineEndMs(TRACKS) * moment,
        colors: COLORS,
        kit: KIT,
        width,
        height,
        isMirrored: false,
      });
      expect(Buffer.from(png)).toMatchImageSnapshot({
        customSnapshotIdentifier: `swap-guard-${name}-${String(moment)}`,
      });
    },
  );
});
