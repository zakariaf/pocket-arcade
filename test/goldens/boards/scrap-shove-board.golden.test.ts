// test/goldens/boards/scrap-shove-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It renders the board through paintBoardPng, the
// same draw() and layout() the device runs, at 3 sizes x 3 moments of the busiest turn. It reads the
// font with node:fs, so it lives under test/ (Node APIs are banned in apps/*/src). Tolerance and diff
// folder come from skia-golden.ts. Create or change the baselines only with
// `npx jest <this file> --selectProjects golden -u`, after opening every PNG, with a Gate-Change trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { BOARD_PALETTES } from '@e07/scrap-shove/board/board-palettes.ts';
import { buildTimeline } from '@e07/scrap-shove/board/build-timeline.ts';
import { scrapShoveBoard } from '@e07/scrap-shove/board/scrap-shove-board.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/scrap-shove/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: scrapShoveBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
const PERSIAN = {
  formatNumber: (value: number) =>
    String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(d))),
};
/**
 * The busiest turn, played by the real rules: the player shoves a heap onto a robot (a crush), two
 * robots crash into a new heap (badge "۲"), one drives into scrap, a heavy robot smashes a heap it
 * cannot shove, and the fast robot steps twice. Moment 0 shows the floor before the move plays
 * (no sparks, badge or arrows yet), 0.5 the crash mid-flight, 1 the final view with its arrows.
 */
const START = stateFromText([
  'h......f',
  '........',
  '........',
  '.....n..',
  'h#n#@...',
  '..#..n..',
  '.n......',
  '......n.',
]);
const TURN = applyMove(START, { kind: 'shove', col: 3, row: 4 });
const VIEW = scrapShoveBoard.toView(TURN.state, PERSIAN);
const TRACKS = buildTimeline(TURN.events, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('scrap-shove board goldens', () => {
  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: scrapShoveBoard.draw,
        layout: scrapShoveBoard.layout,
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
        customSnapshotIdentifier: `scrap-shove-${name}-${String(moment)}`,
      });
    },
  );
});
