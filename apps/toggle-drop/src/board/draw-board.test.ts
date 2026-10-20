// apps/toggle-drop/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { ToggleDropView } from './to-view.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { BoardColors, BoardHighlight, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { ToggleDropEvent } from '@e07/toggle-drop/rules/toggle-drop-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 400;

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
const stubPath = {} as SkPath;
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: { hopper: stubPath, cup: stubPath, check: stubPath },
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const TOKENS: readonly BoardToken[] = [
  'background',
  'lane',
  'chute',
  'edge',
  'lever',
  'pivot',
  'ball',
  'cup',
  'label',
  'hint',
];
const COLORS: BoardColors<BoardToken> = {
  scheme: 'dark',
  isColorBlind: false,
  color: Object.fromEntries(TOKENS.map((token) => [token, COLOR])) as Record<BoardToken, SkColor>,
};

/** The final view of the busiest move on the biggest board: four cups, fifteen switches. */
const VIEW: ToggleDropView = {
  cols: 7,
  rows: 5,
  pegs: Array.from({ length: 35 }, (_, index) => (index % 7 < 3 ? index % 2 : -1)),
  needs: [1, 0, 2, 0, 2, 0, 2],
  filled: [1, 0, 2, 0, 1, 0, 0],
  needTexts: ['', '', '', '', '۱', '', '۲'],
  pendingTexts: ['۱', '', '۱', '', '۲', '', ''],
  ballsLeft: 3,
};
const BUSIEST: readonly ToggleDropEvent[] = [
  { kind: 'ball-dropped', col: 1, x: 180, y: 0, atMs: 0 },
  { kind: 'switch-flipped', col: 1, row: 0, side: 1, x: 180, y: 120, atMs: 167 },
  { kind: 'switch-flipped', col: 2, row: 1, side: 0, x: 300, y: 240, atMs: 333 },
  { kind: 'switch-flipped', col: 1, row: 2, side: 1, x: 180, y: 360, atMs: 500 },
  { kind: 'switch-flipped', col: 2, row: 3, side: 0, x: 300, y: 480, atMs: 667 },
  { kind: 'ball-passed', col: 1, row: 4, x: 180, y: 600, atMs: 833 },
  { kind: 'ball-landed', col: 2, x: 300, y: 720, isInCup: true, wasRedirected: true, atMs: 1000 },
  { kind: 'cup-filled', col: 2, atMs: 1000 },
];
const LAYOUT = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });

type DrawAt = {
  readonly tracks: readonly Track[];
  readonly atMs: number;
  readonly highlight?: BoardHighlight;
  readonly view?: ToggleDropView;
};

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  const view = at.view ?? VIEW;
  drawBoard(canvas, { view, fx, highlight, colors: COLORS, layout: LAYOUT, kit: KIT });
  return recorded;
}

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frame of a move', () => {
    const recorded = draw({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 1100 });
    expect(recorded.calls.get('drawCircle')).toBeGreaterThan(14);
    expect(totalCalls(recorded)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 the ball in the chute, its cup still a ball short, and no burst yet', () => {
    const atStart = draw({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 0 });
    const idle = draw({ tracks: [], atMs: 0 });
    // The ball adds two circles (fill and edge); its cup holds one edged ball fewer (two circles)
    // and shows that ball's empty slot (one ring); a burst drawn too early would add fourteen.
    expect(atStart.calls.get('drawCircle')).toBe((idle.calls.get('drawCircle') ?? 0) + 1);
    // That cup shows the ball it still needs, not its check.
    expect(atStart.texts).toStrictEqual(['۱', '۱', '۲']);
    expect(atStart.calls.get('drawPath')).toBe((idle.calls.get('drawPath') ?? 0) - 1);
  });

  it('draws what each cup still needs in the localised digits, and a check on a full cup', () => {
    const idle = draw({ tracks: [], atMs: 0 });
    expect(idle.texts).toStrictEqual(['۱', '۲']);
    // Seven hoppers, four cups (fill and edge) and the checks of the two full cups.
    expect(idle.calls.get('drawPath')).toBe(7 + 4 * 2 + 2);
  });

  it('shows in each cup its balls as edged dots and each ball it still needs as an empty ring', () => {
    const empty = { ...VIEW, needs: [2, 0, 0, 0, 0, 0, 0], filled: [0, 0, 0, 0, 0, 0, 0] };
    const half = { ...empty, filled: [1, 0, 0, 0, 0, 0, 0] };
    const none = { ...empty, needs: [0, 0, 0, 0, 0, 0, 0] };
    const circles = (view: ToggleDropView): number =>
      draw({ tracks: [], atMs: 0, view }).calls.get('drawCircle') ?? 0;
    expect(circles(empty) - circles(none)).toBe(2);
    expect(circles(half) - circles(none)).toBe(2 + 1);
  });

  it('shows the balls left in a rack above the columns, each an edged ball', () => {
    const none = draw({ tracks: [], atMs: 0, view: { ...VIEW, ballsLeft: 0 } });
    const three = draw({ tracks: [], atMs: 0 });
    expect(three.calls.get('drawCircle')).toBe((none.calls.get('drawCircle') ?? 0) + 3 * 2);
  });

  it('leaves a puff in the gutter while a lost ball lands there, and only then', () => {
    const lost: readonly ToggleDropEvent[] = [
      { kind: 'ball-dropped', col: 1, x: 180, y: 0, atMs: 0 },
      {
        kind: 'ball-landed',
        col: 1,
        x: 180,
        y: 720,
        isInCup: false,
        wasRedirected: false,
        atMs: 1000,
      },
    ];
    const tracks = buildTimeline(lost, 'full');
    const idle = draw({ tracks: [], atMs: 0 }).calls.get('drawCircle') ?? 0;
    // At 1200 ms the ball has melted away and the puff is still growing; at 1400 ms it is gone.
    expect(draw({ tracks, atMs: 1200 }).calls.get('drawCircle')).toBe(idle + 1);
    expect(draw({ tracks, atMs: 1400 }).calls.get('drawCircle')).toBe(idle);
  });

  it('rings the hinted column of the host highlight', () => {
    const hinted = [{ regionId: 'board', col: 3, row: 0 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const withHint = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(withHint.calls.get('drawRRect')).toBe((plain.calls.get('drawRRect') ?? 0) + 1);
  });

  it('draws nothing but the ground before the canvas has a size', () => {
    const { canvas, recorded } = recordingCanvas();
    const layout = layoutBoard({ width: 0, height: 0, view: VIEW, isMirrored: false });
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    drawBoard(canvas, {
      view: VIEW,
      fx,
      highlight: EMPTY_HIGHLIGHT,
      colors: COLORS,
      layout,
      kit: KIT,
    });
    expect([...recorded.calls.keys()]).toStrictEqual(['drawColor']);
  });
});
