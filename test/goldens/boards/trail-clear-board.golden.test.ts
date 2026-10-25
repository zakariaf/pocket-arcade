// test/goldens/boards/trail-clear-board.golden.test.ts
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
import { BOARD_PALETTES } from '@e07/trail-clear/board/board-palettes.ts';
import { buildTimeline } from '@e07/trail-clear/board/build-timeline.ts';
import { toView } from '@e07/trail-clear/board/to-view.ts';
import { trailClearBoard } from '@e07/trail-clear/board/trail-clear-board.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { create } from '@e07/trail-clear/rules/create.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { TrailClearEvent, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/trail-clear/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: trailClearBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'light', isColorBlind: false });
/**
 * The busiest turn of greedy play (seed 53, the endless run, placement 32): a ford closes a road
 * loop and a river loop at once (a double) and wipes five tiles; a road bend is dealt. Moment 0
 * shows the wiped tiles lit before they shrink, 0.5 the double's ring and burst mid-flight with the
 * new tile growing into the tray, 1 the final board.
 */
/** The placements of that game, each as its turns, column and row. */
const LINE =
  '011 110 330 111 320 320 330 130 022 023 312 033 240 102 003 041 043 102 100 004 320 120 024 034 032 231 231 001 033 312 314 003';

function replay(start: TrailClearState): {
  readonly state: TrailClearState;
  readonly events: readonly TrailClearEvent[];
} {
  let played: { state: TrailClearState; events: readonly TrailClearEvent[] } = {
    state: start,
    events: [],
  };
  for (const [turns, col, row] of LINE.split(' ').map((move) =>
    [0, 1, 2].map((at) => Number(move.charAt(at))),
  )) {
    played = applyMove(played.state, {
      kind: 'place-tile',
      turns: turns ?? 0,
      col: col ?? 0,
      row: row ?? 0,
    });
  }
  return played;
}

const PLAYED = replay(create(53, 100));
const VIEW = toView(PLAYED.state, {
  formatNumber: (value) =>
    String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(digit))),
});
const TRACKS = buildTimeline(PLAYED.events, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('trail-clear board goldens', () => {
  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: trailClearBoard.draw,
        layout: trailClearBoard.layout,
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
        customSnapshotIdentifier: `trail-clear-${name}-${String(moment)}`,
      });
    },
  );
});
