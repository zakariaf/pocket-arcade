// apps/flock-tilt/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { TILT_KEY_REGIONS } from './board-ids.ts';
import { BOARD_PALETTES } from './board-palettes.ts';
import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { FlockTiltView } from './to-view.ts';
import type { FlockTiltEvent } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { BoardColors, BoardHighlight, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 300;

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
  color: Object.fromEntries(
    Object.keys(BOARD_PALETTES.dark).map((token) => [token, COLOR]),
  ) as Record<BoardToken, SkColor>,
};

/** The final view after the busiest tilt: two sheep dropped into the pen, the third waits. */
const VIEW: FlockTiltView = {
  cols: 7,
  rows: 7,
  rocks: [0, 3, 13, 21, 23, 37, 38, 40],
  pen: 29,
  sheep: [
    { id: 0, cell: 29, status: 'penned' },
    { id: 1, cell: 7, status: 'field' },
    { id: 2, cell: 29, status: 'penned' },
  ],
  wolves: [{ id: 0, cell: 42 }],
  pennedText: '۲',
  pennedCount: 2,
};
const BUSIEST: readonly FlockTiltEvent[] = [
  {
    kind: 'animals-slid',
    direction: 'left',
    slides: [
      { animal: 'sheep', id: 2, from: 30, to: 29, stoppedBy: 'pen' },
      { animal: 'sheep', id: 0, from: 34, to: 29, stoppedBy: 'pen' },
      { animal: 'sheep', id: 1, from: 13, to: 7, stoppedBy: 'fence' },
      { animal: 'wolf', id: 0, from: 48, to: 42, stoppedBy: 'fence' },
    ],
  },
  { kind: 'sheep-penned', id: 2, cell: 29 },
  { kind: 'sheep-penned', id: 0, cell: 29 },
];
const LAYOUT = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });

type DrawAt = {
  readonly tracks: readonly Track[];
  readonly atMs: number;
  readonly highlight?: BoardHighlight;
  readonly view?: FlockTiltView;
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

const TRACKS = buildTimeline(BUSIEST, 'full');

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frame of a tilt', () => {
    const frames = [0, 0.25, 0.5, 0.75, 1].map((share) =>
      totalCalls(draw({ tracks: TRACKS, atMs: timelineEndMs(TRACKS) * share })),
    );
    expect(Math.max(...frames)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('draws the penned sheep sliding at moment 0 and gone at the end (the view is the final state)', () => {
    const start = draw({ tracks: TRACKS, atMs: 0 });
    const end = draw({ tracks: TRACKS, atMs: timelineEndMs(TRACKS) });
    const still = draw({ tracks: [], atMs: 0 });
    expect(start.calls.get('drawCircle')).toBeGreaterThan(still.calls.get('drawCircle') ?? 0);
    expect(end.calls.get('drawCircle')).toBe(still.calls.get('drawCircle'));
  });

  it('shows at moment 0 no burst that starts later', () => {
    const start = draw({ tracks: TRACKS, atMs: 0 });
    const still = draw({ tracks: [], atMs: 0 });
    const burstAt = TRACKS.find((track) => track.channel === 'burst')?.startMs ?? 0;
    const bursting = draw({ tracks: TRACKS, atMs: burstAt + 100 });
    expect(start.calls.get('drawCircle')).toBeLessThan(bursting.calls.get('drawCircle') ?? 0);
    expect(still.calls.get('drawCircle')).toBeLessThan(start.calls.get('drawCircle') ?? 0);
  });

  it('writes the penned count on the pen in the chosen digits (spec 7.3)', () => {
    expect(draw({ tracks: [], atMs: 0 }).texts).toStrictEqual(['۲']);
  });

  it('rings the hinted tilt key of the host highlight', () => {
    const hinted = [{ regionId: TILT_KEY_REGIONS.left, col: 0, row: 0 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const withHint = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(withHint.calls.get('drawRRect')).toBe((plain.calls.get('drawRRect') ?? 0) + 1);
  });

  it('draws rocks, wolves and the key arrows from the kit unit paths', () => {
    const path = {} as SkPath;
    const pathKit: RenderKit = { ...KIT, paths: { rock: path, wolf: path, arrow: path } };
    const { canvas, recorded } = recordingCanvas();
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    const highlight = EMPTY_HIGHLIGHT;
    drawBoard(canvas, { view: VIEW, fx, highlight, colors: COLORS, layout: LAYOUT, kit: pathKit });
    // Each rock and wolf: fill and edge; each of the four arrows: one fill.
    expect(recorded.calls.get('drawPath')).toBe(VIEW.rocks.length * 2 + VIEW.wolves.length * 2 + 4);
  });

  it('washes the field while the cleared glow, the run-out fade or the rewind plays', () => {
    const glow = buildTimeline([{ kind: 'field-cleared', tilts: 4, par: 4 }], 'full');
    const tired = buildTimeline([{ kind: 'tilts-ran-out', tilts: 40 }], 'full');
    const back = buildTimeline([{ kind: 'tilt-taken-back', tiltsAdded: 10 }], 'full');
    const plain = draw({ tracks: [], atMs: 0 }).calls.get('drawRect') ?? 0;
    for (const tracks of [glow, tired, back]) {
      const middle = timelineEndMs(tracks) - 100;
      expect(draw({ tracks, atMs: middle }).calls.get('drawRect')).toBe(plain + 1);
    }
  });

  it('draws nothing but the background before the canvas has a size', () => {
    const { canvas, recorded } = recordingCanvas();
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    const empty = { width: 0, height: 0, isMirrored: false, regions: [] };
    drawBoard(canvas, {
      view: VIEW,
      fx,
      highlight: EMPTY_HIGHLIGHT,
      colors: COLORS,
      layout: empty,
      kit: KIT,
    });
    expect(totalCalls(recorded)).toBe(1);
  });

  it('marks a lost sheep with a ring once its flash starts, never before', () => {
    const lostView: FlockTiltView = {
      ...VIEW,
      sheep: [{ id: 1, cell: 7, status: 'lost' }],
      wolves: [{ id: 0, cell: 8 }],
    };
    const tracks = buildTimeline(
      [{ kind: 'sheep-lost', id: 1, cell: 7, wolfId: 0, wolfCell: 8 }],
      'full',
    );
    const before = draw({ tracks, atMs: 0, view: lostView });
    const after = draw({ tracks, atMs: timelineEndMs(tracks), view: lostView });
    expect(after.calls.get('drawCircle')).toBe((before.calls.get('drawCircle') ?? 0) + 1);
  });
});
