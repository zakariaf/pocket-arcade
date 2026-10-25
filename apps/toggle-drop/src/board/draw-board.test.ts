// apps/toggle-drop/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { cupEntity } from './board-ids.ts';
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

  it('pops a puff at a full cup while a ball it no longer takes lands there, and only then', () => {
    // Column 0's cup is full (needs 1, holds 1): the ball bounces off it, lost like in the gutter.
    const bounced: readonly ToggleDropEvent[] = [
      { kind: 'ball-dropped', col: 0, x: 60, y: 0, atMs: 0 },
      {
        kind: 'ball-landed',
        col: 0,
        x: 60,
        y: 720,
        isInCup: false,
        wasRedirected: false,
        atMs: 1000,
      },
    ];
    const tracks = buildTimeline(bounced, 'full');
    expect(
      tracks.some((track) => track.channel === 'miss' && track.entityId === cupEntity(0)),
    ).toBe(true);
    const idle = draw({ tracks: [], atMs: 0 }).calls.get('drawCircle') ?? 0;
    // At 1200 ms the ball has melted away and the puff is still growing; at 1400 ms it is gone.
    expect(draw({ tracks, atMs: 1200 }).calls.get('drawCircle')).toBe(idle + 1);
    expect(draw({ tracks, atMs: 1400 }).calls.get('drawCircle')).toBe(idle);
  });

  it('keeps a cup popping through an overshooting pop, until its track ends', () => {
    // An effect plays by its linear time: an out-back pop passes its rest scale early.
    const pop: Track = {
      channel: 'catch',
      entityId: cupEntity(2),
      startMs: 0,
      durationMs: 400,
      easing: 'out-back',
      from: [1.3],
      to: [1],
    };
    const scales = (atMs: number, tracks: readonly Track[] = [pop]): number[] => {
      const seen: number[] = [];
      const canvas = new Proxy(
        {},
        {
          get:
            (_target, name) =>
            (...args: unknown[]) => {
              if (name === 'scale' && typeof args[0] === 'number') seen.push(args[0]);
            },
        },
      ) as SkCanvas;
      const fx = { ...sampleTimeline(tracks, atMs), pointer: IDLE_POINTER };
      const frame = { view: VIEW, fx, highlight: EMPTY_HIGHLIGHT, colors: COLORS, layout: LAYOUT };
      drawBoard(canvas, { ...frame, kit: KIT });
      return seen;
    };
    const atRest = scales(0, []);
    expect(scales(320)).not.toStrictEqual(atRest);
    expect(scales(400)).toStrictEqual(atRest);
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

/** A paint that acts like Skia's: setColor takes the colour's own alpha, setAlphaf replaces it. */
function tokenPaint(token: SkColor): {
  paint: SkPaint;
  alpha: () => number;
  isToken: () => boolean;
} {
  let alpha = 1;
  let isToken = false;
  const paint = new Proxy(
    {},
    {
      get: (_target, name) => (value: unknown) => {
        if (name === 'setColor') {
          isToken = value === token;
          alpha = (value as SkColor)[3] ?? 1;
        }
        if (name === 'setAlphaf' && typeof value === 'number') alpha = value;
      },
    },
  ) as SkPaint;
  return { paint, alpha: () => alpha, isToken: () => isToken };
}

type TokenAt = DrawAt & {
  readonly token: BoardToken;
  readonly paint: 'fill' | 'stroke';
};

/** The alpha of every circle drawn with `token` on one frame where the token has `tokenAlpha`. */
function tokenAlphas(at: TokenAt, tokenAlpha: number): number[] {
  const color = new Float32Array([0, 0, 0, tokenAlpha]) as SkColor;
  const probe = tokenPaint(color);
  const seen: number[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          if (name === 'drawCircle' && args.at(-1) === probe.paint && probe.isToken()) {
            seen.push(probe.alpha());
          }
        },
    },
  ) as SkCanvas;
  const colors = {
    ...COLORS,
    color: new Proxy({}, { get: (_target, name) => (name === at.token ? color : COLOR) }),
  } as unknown as BoardColors<BoardToken>;
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const kit = { ...KIT, [at.paint]: probe.paint };
  const view = at.view ?? VIEW;
  drawBoard(canvas, { view, fx, highlight: EMPTY_HIGHLIGHT, colors, layout: LAYOUT, kit });
  return seen;
}

describe('drawBoard with a translucent token', () => {
  const busiest = buildTimeline(BUSIEST, 'full');
  const startOf = (tracks: readonly Track[], channel: string): number =>
    tracks.find((track) => track.channel === channel)?.startMs ?? 0;
  const lost = buildTimeline(
    [
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
    ],
    'full',
  );
  const bounced = buildTimeline(
    [
      { kind: 'ball-dropped', col: 0, x: 60, y: 0, atMs: 0 },
      {
        kind: 'ball-landed',
        col: 0,
        x: 60,
        y: 720,
        isInCup: false,
        wasRedirected: false,
        atMs: 1000,
      },
    ],
    'full',
  );
  const fading = { tracks: busiest, atMs: startOf(busiest, 'fade') + 40 };
  const cases: readonly (TokenAt & { readonly name: string })[] = [
    { name: 'the landing ball', token: 'ball', paint: 'fill', ...fading },
    { name: 'its ink edge', token: 'edge', paint: 'stroke', ...fading },
    {
      name: 'the cup burst',
      token: 'ball',
      paint: 'fill',
      tracks: busiest,
      atMs: startOf(busiest, 'burst') + 100,
    },
    { name: 'the gutter puff', token: 'chute', paint: 'stroke', tracks: lost, atMs: 1200 },
    { name: 'the full-cup puff', token: 'chute', paint: 'stroke', tracks: bounced, atMs: 1200 },
  ];

  // Spec 8.12: the board draws from its palette tokens, so a token's own alpha must survive a fade.
  it.each(cases)('keeps the token alpha under the fade of $name', (at) => {
    const opaque = tokenAlphas(at, 1);
    expect(opaque.filter((alpha) => alpha > 0 && alpha < 1).length).toBeGreaterThan(0);
    expect(tokenAlphas(at, 0.5)).toStrictEqual(opaque.map((alpha) => alpha * 0.5));
  });
});
