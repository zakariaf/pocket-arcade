// test/goldens/boards/merge-siege-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It renders the board through paintBoardPng, the
// same draw() and layout() the device runs, at 3 sizes x 3 moments of the busiest turn. It reads the
// font with node:fs, so it lives under test/ (Node APIs are banned in apps/*/src). Tolerance and diff
// folder come from skia-golden.ts. Create or change the baselines only with
// `npx jest <this file> --selectProjects golden -u`, after opening every PNG, with a Gate-Change trailer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { BOARD_PALETTES } from '@e07/merge-siege/board/board-palettes.ts';
import { buildTimeline } from '@e07/merge-siege/board/build-timeline.ts';
import { mergeSiegeBoard } from '@e07/merge-siege/board/merge-siege-board.ts';
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { parseBoard } from '@e07/merge-siege/rules/board-text.ts';
import { create } from '@e07/merge-siege/rules/create.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly. */
const FONT = join(process.cwd(), 'apps/merge-siege/assets/fonts/Vazirmatn-Regular.ttf');
const TYPEFACE = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, {
  paths: mergeSiegeBoard.buildPaths(Skia),
  numberTypeface: TYPEFACE,
  numberSize: 16,
});
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
const PERSIAN = {
  formatNumber: (value: number): string =>
    String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit),
};
/**
 * A mid-run board (the daily's difficulty, sixth swipe, so the enemies march), with Persian digits.
 * The swipe up is the busiest kind of turn: a 2 smashes the 2-enemy in its column and the 2 behind
 * it merges into it, a 4 is lost to an 8-enemy, the enemies march, the 4-enemy at the gate crushes
 * the 2 in its way, and a new tile appears. Moment 0 shows the board before the swipe (no burst
 * yet), 0.5 the march and the gate mid-flight, 1 the final view with the next enemy in the gate.
 */
const BEFORE: MergeSiegeState = {
  ...create(6, 45),
  swipes: 5,
  nextId: 10,
  next: { col: 4, value: 4 },
  cells: parseBoard([
    '.  .  e2 e8 .',
    '.  e8 .  .  .',
    '.  .  .  e8 .',
    '.  .  .  .  .',
    '.  .  2  .  2',
    '.  .  2  4  8',
  ]),
};
const TURN = applyMove(BEFORE, { kind: 'swipe', direction: 'up' });
const VIEW = mergeSiegeBoard.toView(TURN.state, PERSIAN);
const TRACKS = buildTimeline(TURN.events, 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;
const CASES = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment })));

describe('merge-siege board goldens', () => {
  it('plays the busiest kind of turn: a merge, a smash, a loss, the march and the gate', () => {
    const kinds = new Set(TURN.events.map((event) => event.kind));
    expect([...kinds].sort()).toStrictEqual([
      'enemies-marched',
      'enemies-smashed',
      'enemy-entered',
      'score-added',
      'tile-spawned',
      'tiles-lost',
      'tiles-merged',
      'tiles-slid',
    ]);
  });

  it.each(CASES)(
    'renders $name at $moment of the busiest turn',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: mergeSiegeBoard.draw,
        layout: mergeSiegeBoard.layout,
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
        customSnapshotIdentifier: `merge-siege-${name}-${String(moment)}`,
      });
    },
  );
});
