// apps/tap-flip/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { TapFlipView } from './to-view.ts';
import type { TapFlipEvent } from '@e07/tap-flip/rules/tap-flip-types.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type {
  BoardColors,
  BoardHighlight,
  RenderKit,
} from '@e07/shell/game-host/board-types.ts';
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

const stubFont = {
  getSize: () => 16,
  getGlyphIDs: () => [1, 2],
  getGlyphWidths: () => [8, 8],
} as unknown as SkFont;
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
    lit: COLOR,
    edge: COLOR,
    mark: COLOR,
    glow: COLOR,
    label: COLOR,
    hint: COLOR,
  },
};
/** The final view of the busiest turn: the plus-shaped flip that cleared a 5 × 5 board. */
const VIEW: TapFlipView = {
  cols: 5,
  rows: 5,
  cells: Array.from({ length: 25 }, () => 0),
  movesLeftText: '۱۲',
};
const BUSIEST: readonly TapFlipEvent[] = [
  { kind: 'cells-flipped', cells: [7, 2, 6, 8, 12] },
  { kind: 'board-cleared' },
];
const LAYOUT = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });

type DrawAt = { readonly tracks: readonly Track[]; readonly atMs: number; readonly highlight?: BoardHighlight };

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  drawBoard(canvas, { view: VIEW, fx, highlight, colors: COLORS, layout: LAYOUT, kit: KIT });
  return recorded;
}

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frame of a turn', () => {
    const recorded = draw({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 400 });
    expect(recorded.calls.get('drawCircle')).toBeGreaterThan(1);
    expect(totalCalls(recorded)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 no effect that starts later (glow and burst wait for their track)', () => {
    const recorded = draw({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 0 });
    // Before the move the flipped cells still show their old, lit face with its edge and mark.
    expect(recorded.calls.get('drawCircle')).toBe(5);
    expect(recorded.calls.get('drawRRect')).toBe(25 + 5);
  });

  it('draws the localised moves-left label while a continue adds moves, which a 0.1 % golden could miss', () => {
    const tracks = buildTimeline([{ kind: 'moves-added', count: 3 }], 'full');
    expect(draw({ tracks, atMs: 0 }).texts).toStrictEqual([]);
    expect(draw({ tracks, atMs: 200 }).texts).toStrictEqual(['۱۲']);
  });

  it('rings each hinted cell of the host highlight', () => {
    const hinted = [{ regionId: 'board', col: 2, row: 2 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const withHint = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(totalCalls(withHint)).toBeGreaterThan(totalCalls(plain));
    expect(withHint.calls.get('drawRRect')).toBe((plain.calls.get('drawRRect') ?? 0) + 1);
  });
});
