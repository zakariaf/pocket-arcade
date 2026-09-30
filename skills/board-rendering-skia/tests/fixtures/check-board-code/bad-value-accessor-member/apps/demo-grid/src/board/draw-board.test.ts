// apps/demo-grid/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { DemoGridView } from './to-view.ts';
import type { BoardColors, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 250;

type Recorded = { readonly calls: Map<string, number>; readonly texts: string[] };

/** Counts every canvas call (a headless proxy for draw calls per frame) and keeps drawText strings. */
function recordingCanvas(): { canvas: SkCanvas; recorded: Recorded } {
  const recorded: Recorded = { calls: new Map(), texts: [] };
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          recorded.calls.set(String(name), (recorded.calls.get(String(name)) ?? 0) + 1);
          if (name === 'drawText' && typeof args[0] === 'string') recorded.texts.push(args[0]);
        },
    },
  ) as SkCanvas;
  return { canvas, recorded };
}

const stubFont = { getGlyphIDs: () => [1, 2], getGlyphWidths: () => [8, 8] } as unknown as SkFont;
const stubPaint = new Proxy({}, { get: () => () => undefined }) as SkPaint;
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: {},
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const COLORS: BoardColors<BoardToken> = {
  scheme: 'dark',
  isColorBlind: false,
  color: {
    background: COLOR,
    cell: COLOR,
    filled: COLOR,
    piece: COLOR,
    label: COLOR,
    effect: COLOR,
    ghost: COLOR,
  },
};
const VIEW: DemoGridView = {
  cols: 8,
  rows: 8,
  cells: Array.from({ length: 64 }, (_, i) => (i % 3 === 0 ? 1 : 0)),
  pieces: [
    { id: 1, col: 0, row: 3, label: '8' },
    { id: 3, col: 5, row: 6, label: '2' },
  ],
};
const LAYOUT = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frame of a turn', () => {
    const tracks = buildTimeline(
      [
        { kind: 'piece-moved', pieceId: 1, fromCol: 0, fromRow: 0, toCol: 0, toRow: 3 },
        { kind: 'piece-removed', pieceId: 2, col: 4, row: 4 },
      ],
      'full',
    );
    const fx = { ...sampleTimeline(tracks, 300), pointer: IDLE_POINTER };
    const { canvas, recorded } = recordingCanvas();
    drawBoard(canvas, { view: VIEW, fx, colors: COLORS, layout: LAYOUT, kit: KIT });
    expect(recorded.calls.get('drawCircle')).toBeGreaterThan(1);
    expect(totalCalls(recorded)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('draws every localised label, which a 0.1 % pixel golden could miss', () => {
    const view = { ...VIEW, pieces: [{ id: 1, col: 2, row: 1, label: '۱۲' }] };
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    const { canvas, recorded } = recordingCanvas();
    drawBoard(canvas, { view, fx, colors: COLORS, layout: LAYOUT, kit: KIT });
    expect(recorded.texts).toStrictEqual(['۱۲']);
  });

  it('draws a ghost only while a finger hovers a board cell', () => {
    const pointer = { ...IDLE_POINTER, isDown: true, hover: { regionId: 'board', col: 1, row: 1 } };
    const idle = recordingCanvas();
    const down = recordingCanvas();
    const fx = sampleTimeline([], 0);
    drawBoard(idle.canvas, {
      view: VIEW,
      fx: { ...fx, pointer: IDLE_POINTER },
      colors: COLORS,
      layout: LAYOUT,
      kit: KIT,
    });
    drawBoard(down.canvas, {
      view: VIEW,
      fx: { ...fx, pointer },
      colors: COLORS,
      layout: LAYOUT,
      kit: KIT,
    });
    expect(totalCalls(down.recorded)).toBe(totalCalls(idle.recorded) + 1);
  });
});
