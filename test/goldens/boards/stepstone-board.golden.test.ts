// test/goldens/boards/stepstone-board.golden.test.ts
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
import { BOARD_PALETTES } from '@e07/stepstone/board/board-palettes.ts';
import { buildTimeline } from '@e07/stepstone/board/build-timeline.ts';
import { stepstoneBoard } from '@e07/stepstone/board/stepstone-board.ts';
import { toView } from '@e07/stepstone/board/to-view.ts';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/stepstone/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: stepstoneBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
/**
 * The busiest turn: a full 7 x 7 pond of all four hop kinds with a row of sunk stones; the frog's
 * rook at 3 hops down its column onto the flag at 45 (the stone it leaves sinks, the flag glows,
 * particles burst and the hop count, in Persian digits, pops above the flag).
 */
const BUSY: StepstoneState = {
  ...pondFromText(
    ['KRBrNKR', 'BNKRBNK', 'RKBNRKB', 'NRKBNRK', 'KBNRKBN', 'B~~~~~R', 'R..F..K'].join('\n'),
  ),
  moves: 11,
  par: 9,
  kindsUsed: ['rook', 'king'],
};
const WIN = applyMove(BUSY, { kind: 'hop', to: 45 });
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };
const VIEW = toView(WIN.state, PERSIAN);
const TRACKS = buildTimeline(WIN.events, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('stepstone board goldens', () => {
  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: stepstoneBoard.draw,
        layout: stepstoneBoard.layout,
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
        customSnapshotIdentifier: `stepstone-${name}-${String(moment)}`,
      });
    },
  );
});
