// test/goldens/boards/demo-tutorial.golden.test.ts
// PIXEL GOLDEN of one fixed scene (the tutorial's first board with the pointing hand), beside the
// game's board golden: one phone size and the hand's own phases, not the 3 sizes x 3 moments of the
// busiest turn that demo-board.golden.test.ts covers. Baselines change only with a Gate-Change trailer.
import { Skia } from '@shopify/react-native-skia';

import { BOARD_PALETTES } from '@e07/demo/board/board-palettes.ts';
import { demoBoard } from '@e07/demo/board/demo-board.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { DemoView } from '@e07/demo/board/to-view.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

const KIT = makeBoardKit(Skia, { paths: demoBoard.buildPaths(Skia), numberTypeface: null, numberSize: 16 });
const VIEW: DemoView = { cols: 8, rows: 8, cells: [], pieces: [] };
const PHASES = [0, 0.3, 1] as const;

describe("the tutorial's first board", () => {
  it.each(PHASES)('shows the hand at %s', (phase) => {
    const png = paintBoardPng(Skia, {
      draw: demoBoard.draw,
      layout: demoBoard.layout,
      view: VIEW,
      tracks: [],
      elapsedMs: 0,
      colors: makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'light', isColorBlind: false }),
      kit: KIT,
      width: 390,
      height: 560,
      isMirrored: false,
    });
    expect(Buffer.from(png)).toMatchImageSnapshot({ customSnapshotIdentifier: `demo-tutorial-${String(phase)}` });
  });
});
