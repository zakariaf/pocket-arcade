// test/goldens/boards/snare-snake-board.golden.test.ts
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
import { BOARD_PALETTES } from '@e07/snare-snake/board/board-palettes.ts';
import { buildTimeline } from '@e07/snare-snake/board/build-timeline.ts';
import { snareSnakeBoard } from '@e07/snare-snake/board/snare-snake-board.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { SnareSnakeView } from '@e07/snare-snake/board/to-view.ts';
import type { SnareSnakeEvent } from '@e07/snare-snake/rules/snare-snake-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/snare-snake/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: snareSnakeBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
/**
 * A real turn of the hardest row (seed 2, difficulty 90, move 10, played by the greedy bot), with
 * Persian digits: the head bumps its body, the four-cell loop spends three segments and catches two
 * critters next to it, and one critter hops. Moment 0 shows the board before the move plays (the
 * spent segments and the caught critters still there), 0.5 the bursts mid-flight, 1 the final view.
 */
const VIEW: SnareSnakeView = {
  cols: 8,
  rows: 10,
  snake: [12, 11, 19, 27, 35, 34, 33, 25, 24, 16],
  heading: 'right',
  critters: [
    { id: 1, cell: 47, isFrozen: false },
    { id: 3, cell: 76, isFrozen: false },
    { id: 5, cell: 73, isFrozen: false },
  ],
  movesLeftText: '۲۴',
  movesLeft: 24,
  caught: 4,
  total: 7,
};
const EVENTS: readonly SnareSnakeEvent[] = [
  { kind: 'loop-closed', loop: [13, 5, 4, 12], enclosed: [], spent: 3, length: 10 },
  { kind: 'critters-caught', critterIds: [2, 6], cells: [3, 6], count: 2, points: 40 },
  { kind: 'critters-moved', hops: [{ critterId: 3, from: 77, to: 76 }] },
];
const TRACKS = buildTimeline(EVENTS, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('snare-snake board goldens', () => {
  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: snareSnakeBoard.draw,
        layout: snareSnakeBoard.layout,
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
        customSnapshotIdentifier: `snare-snake-${name}-${String(moment)}`,
      });
    },
  );
});
