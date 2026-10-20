// test/goldens/boards/jump-chain-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It renders the board through paintBoardPng, the
// same draw() and layout() the device runs, at 3 sizes x 3 moments of the busiest turn. It reads the
// font with node:fs, so it lives under test/ (Node APIs are banned in apps/*/src). Tolerance and diff
// folder come from skia-golden.ts. Create or change the baselines only with
// `npx jest <this file> --selectProjects golden -u`, after opening every PNG, with a Gate-Change trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { BOARD_PALETTES } from '@e07/jump-chain/board/board-palettes.ts';
import { buildTimeline } from '@e07/jump-chain/board/build-timeline.ts';
import { jumpChainBoard } from '@e07/jump-chain/board/jump-chain-board.ts';
import { toView } from '@e07/jump-chain/board/to-view.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { moveEndingAt } from '@e07/jump-chain/rules/move-ends.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/jump-chain/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: jumpChainBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'light', isColorBlind: false });
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };

/** Enemies as [col, row, rank]: the front rank, a second rank, and a third waiting above. */
const ENEMIES = [
  [1, 5, 0],
  [3, 5, 0],
  [1, 3, 0],
  [3, 3, 0],
  [5, 3, 1],
  [5, 1, 1],
  [1, 1, 1],
  [3, -1, 2],
  [5, -1, 2],
] as const;
/** The march is due: the busiest turn plays a chain, a cleared rank, then the advance. */
const BEFORE: JumpChainState = {
  ...create(1, 0),
  piece: { col: 2, row: 6 },
  enemies: ENEMIES.map(([col, row, rank], id) => ({ id, rank, col, row })),
  total: ENEMIES.length,
  nextId: ENEMIES.length,
  nextRank: 3,
  marchIn: 1,
};
/** The four-jump chain that ends where it began: it captures the whole front rank. */
const CHAIN = moveEndingAt(BEFORE, { col: 2, row: 6 });
if (CHAIN === null) throw new Error('the chain is not listed');
const RESULT = applyMove(BEFORE, CHAIN);
const VIEW = toView(RESULT.state, PERSIAN);
const TRACKS = buildTimeline(RESULT.events, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('jump-chain board goldens', () => {
  it('plays the four-jump chain that clears the front rank', () => {
    expect(CHAIN).toMatchObject({ kind: 'jump' });
    expect(RESULT.events.map((event) => event.kind)).toContain('rank-cleared');
  });

  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: jumpChainBoard.draw,
        layout: jumpChainBoard.layout,
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
        customSnapshotIdentifier: `jump-chain-${name}-${String(moment)}`,
      });
    },
  );
});
