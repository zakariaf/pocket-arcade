// test/goldens/boards/line-siege-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It reads the font with node:fs, so it lives
// under test/ (Node APIs are banned in apps/*/src); tolerance and diff folder come from skia-golden.ts.
// Create or change baselines only with `npx jest <this file> --selectProjects golden -u`, after
// looking at every PNG, and commit with a `Gate-Change:` trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { BOARD_PALETTES } from '@e07/line-siege/board/board-palettes.ts';
import { buildTimeline } from '@e07/line-siege/board/build-timeline.ts';
import { lineSiegeBoard } from '@e07/line-siege/board/line-siege-board.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { LineSiegeView } from '@e07/line-siege/board/to-view.ts';
import type { LineSiegeEvent } from '@e07/line-siege/rules/line-siege-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/line-siege/assets/fonts/Vazirmatn-Regular.ttf');
const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: lineSiegeBoard.buildPaths(Skia),
  numberTypeface: typeface,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
/**
 * A realistic mid-run view after the busiest turn, with Persian digits. Moment 0 shows the board
 * before the move plays (no beam, wave, flash or burst yet), 0.5 the effects mid-flight, 1 the
 * final view (the breached heart empty on the wall).
 */
const VIEW: LineSiegeView = {
  size: 8,
  laneRows: 6,
  // Row 4 and column 7 were just cleared, so they are empty in the final view.
  cells: Array.from({ length: 64 }, (_, i) => {
    const isCleared = Math.floor(i / 8) === 4 || i % 8 === 7;
    return !isCleared && ((i % 8 === 1 && i < 40) || i % 11 === 0 || (i >= 48 && i < 53)) ? 1 : 0;
  }),
  monsters: [
    { id: 2, kind: 'normal', lane: 1, row: 4, hpText: '۳' },
    { id: 3, kind: 'armoured', lane: 4, row: 2, hpText: '۹' },
    { id: 6, kind: 'fast', lane: 6, row: 0, hpText: '۱۲' },
  ],
  tray: [[0, 0, 1, 0, 0, 1, 1, 1], [], [0, 0, 1, 0, 2, 0, 1, 1]],
  hearts: 2,
  maxHearts: 3,
};
/** The busiest turn: a row and a column clear, a beam defeat with its burst, a march and a breach. */
const EVENTS: readonly LineSiegeEvent[] = [
  { kind: 'block-placed', trayIndex: 1, piece: 2, cells: [31, 39] },
  { kind: 'row-cleared', row: 4 },
  { kind: 'column-cleared', col: 7 },
  { kind: 'beam-fired', lane: 7, targetId: 1 },
  { kind: 'monster-hit', monsterId: 1, damage: 8, hpLeft: 0 },
  { kind: 'shockwave-sent', rows: 1, damage: 2 },
  { kind: 'monster-hit', monsterId: 2, damage: 2, hpLeft: 3 },
  { kind: 'monster-defeated', monsterId: 1, monsterKind: 'normal', lane: 7, row: 3 },
  { kind: 'monster-moved', monsterId: 2, fromRow: 3, toRow: 4 },
  { kind: 'monster-moved', monsterId: 5, fromRow: 5, toRow: 6 },
  { kind: 'wall-breached', monsterId: 5, monsterKind: 'fast', lane: 3, heartsLeft: 2 },
  { kind: 'monster-spawned', monsterId: 6, monsterKind: 'fast', lane: 6, hp: 12 },
];
const TRACKS = buildTimeline(EVENTS, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;

describe('line siege board goldens', () => {
  it.each(SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment }))))(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: lineSiegeBoard.draw,
        layout: lineSiegeBoard.layout,
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
        customSnapshotIdentifier: `line-siege-${name}-${String(moment)}`,
      });
    },
  );
});
