// test/goldens/boards/toggle-drop-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It renders the board through paintBoardPng, the
// same draw() and layout() the device runs, at 3 sizes x 3 moments of a busy drop. It reads the
// font with node:fs, so it lives under test/ (Node APIs are banned in apps/*/src). Tolerance and diff
// folder come from skia-golden.ts. Create or change the baselines only with
// `npx jest <this file> --selectProjects golden -u`, after opening every PNG, with a Gate-Change trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';
import { BOARD_PALETTES } from '@e07/toggle-drop/board/board-palettes.ts';
import { buildTimeline } from '@e07/toggle-drop/board/build-timeline.ts';
import { toggleDropBoard } from '@e07/toggle-drop/board/toggle-drop-board.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/toggle-drop/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: toggleDropBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
const PERSIAN = { formatNumber: (value: number) => '۰۱۲۳۴۵۶۷۸۹'.charAt(value) };
/**
 * A busy drop on the biggest board (seed 2 at difficulty 99: 7 columns, 5 peg rows, 4 cups): after
 * three drops in column 0 the fourth zig-zags through three switches, flips each, and fills a
 * second cup; two cups still need balls.
 */
const DROP = { kind: 'drop', col: 0 } as const;
const BEFORE = [DROP, DROP, DROP].reduce(
  (state, move) => applyMove(state, move).state,
  create(2, 99),
);
const MOVE = applyMove(BEFORE, DROP);
const VIEW = toggleDropBoard.toView(MOVE.state, PERSIAN);
const TRACKS = buildTimeline(MOVE.events, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('toggle-drop board goldens', () => {
  it('replays a busy drop: three switches flip and a second cup fills', () => {
    expect(MOVE.events.filter((event) => event.kind === 'switch-flipped')).toHaveLength(3);
    expect(MOVE.events.filter((event) => event.kind === 'cup-filled')).toHaveLength(1);
  });

  it.each(CASES)('renders $name at $moment of the busy drop', ({ width, height, moment, name }) => {
    const png = paintBoardPng(Skia, {
      draw: toggleDropBoard.draw,
      layout: toggleDropBoard.layout,
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
      customSnapshotIdentifier: `toggle-drop-${name}-${String(moment)}`,
    });
  });
});
