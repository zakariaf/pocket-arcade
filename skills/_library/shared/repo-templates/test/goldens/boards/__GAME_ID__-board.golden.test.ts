// test/goldens/boards/__GAME_ID__-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It renders the board through paintBoardPng, the
// same draw() and layout() the device runs, at 3 sizes x 3 moments of the busiest turn. It reads the
// font with node:fs, so it lives under test/ (Node APIs are banned in apps/*/src). Tolerance and diff
// folder come from skia-golden.ts. Create or change the baselines only with
// `npx jest <this file> --selectProjects golden -u`, after opening every PNG, with a Gate-Change trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { __GAME_CAMEL__Board } from '@e07/__GAME_ID__/board/__GAME_ID__-board.ts';
import { BOARD_PALETTES } from '@e07/__GAME_ID__/board/board-palettes.ts';
import { buildTimeline } from '@e07/__GAME_ID__/board/build-timeline.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { __GAME_PASCAL__View } from '@e07/__GAME_ID__/board/to-view.ts';
import type { __GAME_PASCAL__Event } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/__GAME_ID__/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: __GAME_CAMEL__Board.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
/** The final view of the busiest turn: the tap on the middle cell cleared the last lit plus. */
const VIEW: __GAME_PASCAL__View = {
  cols: 5,
  rows: 5,
  cells: Array.from({ length: 25 }, () => 0),
  movesLeftText: '۹',
};
/** The busiest turn: five cells turn over and the board clears (glow and particle burst). */
const EVENTS: readonly __GAME_PASCAL__Event[] = [
  { kind: 'cells-flipped', cells: [12, 7, 11, 13, 17] },
  { kind: 'board-cleared' },
];
const TRACKS = buildTimeline(EVENTS, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('__GAME_ID__ board goldens', () => {
  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: __GAME_CAMEL__Board.draw,
        layout: __GAME_CAMEL__Board.layout,
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
        customSnapshotIdentifier: `__GAME_ID__-${name}-${String(moment)}`,
      });
    },
  );
});
