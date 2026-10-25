// test/goldens/boards/flock-tilt-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It renders the board through paintBoardPng, the
// same draw() and layout() the device runs, at 3 sizes x 3 moments of the busiest turn. It reads the
// font with node:fs, so it lives under test/ (Node APIs are banned in apps/*/src). Tolerance and diff
// folder come from skia-golden.ts. Create or change the baselines only with
// `npx jest <this file> --selectProjects golden -u`, after opening every PNG, with a Gate-Change trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { BOARD_PALETTES } from '@e07/flock-tilt/board/board-palettes.ts';
import { buildTimeline } from '@e07/flock-tilt/board/build-timeline.ts';
import { flockTiltBoard } from '@e07/flock-tilt/board/flock-tilt-board.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { FlockTiltView } from '@e07/flock-tilt/board/to-view.ts';
import type { FlockTiltEvent } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/flock-tilt/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: flockTiltBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
/**
 * The final view of the busiest turn on level 1: the second tilt of its won line (left), where two
 * sheep drop into the pen one after the other while the wolf slides along the bottom row.
 */
const VIEW: FlockTiltView = {
  cols: 7,
  rows: 7,
  rocks: [0, 3, 13, 21, 23, 37, 38, 40],
  pen: 29,
  sheep: [
    { id: 0, cell: 29, status: 'penned' },
    { id: 1, cell: 24, status: 'field' },
    { id: 2, cell: 29, status: 'penned' },
  ],
  wolves: [{ id: 0, cell: 42 }],
  pennedText: '۲',
  pennedCount: 2,
};
/** The busiest turn: three animals slide, two sheep drop into the pen (bumps and bursts). */
const EVENTS: readonly FlockTiltEvent[] = [
  {
    kind: 'animals-slid',
    direction: 'left',
    cols: 7,
    slides: [
      { animal: 'sheep', id: 2, from: 30, to: 29, stoppedBy: 'pen' },
      { animal: 'sheep', id: 0, from: 31, to: 29, stoppedBy: 'pen' },
      { animal: 'wolf', id: 0, from: 46, to: 42, stoppedBy: 'fence' },
    ],
  },
  { kind: 'sheep-penned', id: 2, cell: 29 },
  { kind: 'sheep-penned', id: 0, cell: 29 },
];
const TRACKS = buildTimeline(EVENTS, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('flock-tilt board goldens', () => {
  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: flockTiltBoard.draw,
        layout: flockTiltBoard.layout,
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
        customSnapshotIdentifier: `flock-tilt-${name}-${String(moment)}`,
      });
    },
  );
});
