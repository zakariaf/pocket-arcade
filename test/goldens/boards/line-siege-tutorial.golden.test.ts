// test/goldens/boards/line-siege-tutorial.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit): the tutorial's first board as a new player
// sees it, with step 1's pointer resolved the device's way (coachPointerOf through the game's
// intentToMove and targetsOfMove) and the Shell's pointing hand at the gap. Spec S13: the gap is
// two EMPTY cells (column 7, rows 3 and 4), marked hollow, never drawn as a placed block.
// Create or change baselines only with `npx jest <this file> --selectProjects golden -u`, after
// looking at every PNG, and commit with a `Gate-Change:` trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { BOARD_PALETTES } from '@e07/line-siege/board/board-palettes.ts';
import { lineSiegeBoard } from '@e07/line-siege/board/line-siege-board.ts';
import { intentToMove } from '@e07/line-siege/rules/intent-to-move.ts';
import { PALETTE } from '@e07/line-siege/theme/palette.ts';
import { LINE_SIEGE_TEACHING } from '@e07/line-siege/tutorial/line-siege-teaching.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { boardNumberTypefaceOf } from '@e07/shell/game-host/board-number-typeface.ts';
import { coachGameOf, coachPointerOf } from '@e07/shell/game-host/coach-pointer.ts';
import { coachHandGlide, drawCoachHand } from '@e07/shell/game-host/draw-coach-hand.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { BoardToken } from '@e07/line-siege/board/board-palettes.ts';
import type { LineSiegeView } from '@e07/line-siege/board/to-view.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

const FONTS = join(process.cwd(), 'apps/line-siege/assets/fonts');
const KIT = makeBoardKit(Skia, {
  paths: lineSiegeBoard.buildPaths(Skia),
  numberTypeface: boardNumberTypefaceOf(Skia, (fileName) =>
    Uint8Array.from(readFileSync(join(FONTS, fileName))),
  ),
  numberSize: 18,
});
const { start, steps } = LINE_SIEGE_TEACHING.tutorial;
const GAME = coachGameOf({ engine: { intentToMove }, presentation: { board: lineSiegeBoard } });
const COACH = coachPointerOf(GAME, start, steps[0]?.pointer ?? null);
const VIEW = lineSiegeBoard.toView(start, { formatNumber: String });
const SCHEMES = ['light', 'dark'] as const;
/** The hand at the slot (0), on its way (0.3) and pointing into the gap (1). */
const PHASES = [0, 0.3, 1] as const;

function drawWithHand(scheme: 'light' | 'dark', phase: number) {
  const tokens = PALETTE.standard[scheme];
  const look = { fill: Skia.Color(tokens.pop), ink: Skia.Color(tokens.onPop) };
  return (canvas: SkCanvas, frame: DrawFrame<LineSiegeView, BoardToken>): void => {
    lineSiegeBoard.draw(canvas, frame);
    const { hand } = COACH;
    if (hand === null) throw new Error('step 1 has a pointing hand');
    const glide = coachHandGlide(frame.layout, { hand, cells: COACH.cells });
    drawCoachHand(canvas, { glide, look, kit: KIT }, phase);
  };
}

describe("the tutorial's first board", () => {
  it.each(SCHEMES.flatMap((scheme) => PHASES.map((phase) => ({ scheme, phase }))))(
    'shows the two-cell gap and the hand at $phase in $scheme',
    ({ scheme, phase }) => {
      const png = paintBoardPng(Skia, {
        draw: drawWithHand(scheme, phase),
        layout: lineSiegeBoard.layout,
        view: VIEW,
        tracks: [],
        elapsedMs: 0,
        colors: makeBoardColors(Skia, BOARD_PALETTES, { scheme, isColorBlind: false }),
        kit: KIT,
        width: 390,
        height: 560,
        isMirrored: false,
        highlight: { selected: null, hinted: COACH.cells },
      });
      expect(Buffer.from(png)).toMatchImageSnapshot({
        customSnapshotIdentifier: `line-siege-tutorial-${scheme}-${String(phase)}`,
      });
    },
  );
});
