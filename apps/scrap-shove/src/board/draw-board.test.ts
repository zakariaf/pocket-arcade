// apps/scrap-shove/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { ScrapShoveView } from './to-view.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { ScrapShoveMove } from '@e07/scrap-shove/rules/scrap-shove-types.ts';
import type { BoardColors, BoardHighlight, RenderKit } from '@e07/shell/game-host/board-types.ts';
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
  paths: { arrow: stubPath, finWest: stubPath, finEast: stubPath },
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const TOKENS = Object.keys(BOARD_PALETTES.light) as BoardToken[];
const COLORS: BoardColors<BoardToken> = {
  scheme: 'dark',
  isColorBlind: false,
  color: Object.fromEntries(TOKENS.map((token) => [token, COLOR])) as Record<BoardToken, SkColor>,
};
const PERSIAN = {
  formatNumber: (value: number) =>
    String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(d))),
};

/** A turn as the board sees it: the final view and the tracks of the move's events. */
type Turn = { readonly view: ScrapShoveView; readonly tracks: readonly Track[] };

function turnOf(floor: readonly string[], move: ScrapShoveMove): Turn {
  const { state, events } = applyMove(stateFromText(floor), move);
  return { view: toView(state, PERSIAN), tracks: buildTimeline(events, 'full') };
}

/** The busiest turn: a crush, a two-robot crash, a wreck on scrap, a smashed heap, a fast double step. */
const BUSY = turnOf(
  ['h......f', '........', '........', '.....n..', 'h#n#@...', '..#..n..', '.n......', '......n.'],
  { kind: 'shove', col: 3, row: 4 },
);
const CAUGHT = turnOf(['....', '.n..', '..@.', '....'], { kind: 'wait' });

type DrawAt = {
  readonly turn: Turn;
  readonly atMs: number;
  readonly highlight?: BoardHighlight;
};

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  const { view, tracks } = at.turn;
  const fx = { ...sampleTimeline(tracks, at.atMs), pointer: IDLE_POINTER };
  const layout = layoutBoard({ width: 390, height: 560, view, isMirrored: false });
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  drawBoard(canvas, { view, fx, highlight, colors: COLORS, layout, kit: KIT });
  return recorded;
}

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

function idle(floor: readonly string[]): Turn {
  return { view: toView(stateFromText(floor), PERSIAN), tracks: [] };
}

/** The calls one lone robot of a kind costs: its shape, told apart without colour. */
function shapeOf(letter: string): string {
  const { calls } = draw({ turn: idle(['....', `.${letter}..`, '...@', '....']), atMs: 0 });
  return ['drawPath', 'drawLine', 'drawCircle'].map((name) => calls.get(name) ?? 0).join();
}

describe('drawBoard', () => {
  it('stays within the draw-call budget on every frame of the busiest turn', () => {
    const endMs = timelineEndMs(BUSY.tracks);
    const frames = Array.from({ length: 25 }, (_, i) =>
      draw({ turn: BUSY, atMs: (endMs * i) / 24 }),
    );
    expect(Math.max(...frames.map(totalCalls))).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 no effect that starts later (sparks, badge, arrows wait for their track)', () => {
    const start = draw({ turn: BUSY, atMs: 0 });
    expect([start.texts, start.calls.get('rotate')]).toStrictEqual([[], undefined]);
    const end = draw({ turn: BUSY, atMs: timelineEndMs(BUSY.tracks) });
    expect(end.calls.get('rotate')).toBe(BUSY.view.robots.length);
  });

  it('draws the crash size in the chosen digits while the badge shows, which a 0.1 % golden could miss', () => {
    const badge = BUSY.tracks.find((track) => track.channel === 'badge');
    expect(draw({ turn: BUSY, atMs: (badge?.startMs ?? 0) + 50 }).texts).toStrictEqual(['۲']);
  });

  it('draws the robots and the heap that broke this turn until they fade, then the final view', () => {
    const final = draw({ turn: { view: BUSY.view, tracks: [] }, atMs: 0 });
    const early = draw({ turn: BUSY, atMs: 1 });
    const end = draw({ turn: BUSY, atMs: timelineEndMs(BUSY.tracks) });
    expect(early.calls.get('drawRRect') ?? 0).toBeGreaterThan(final.calls.get('drawRRect') ?? 0);
    expect(end.calls).toStrictEqual(final.calls);
  });

  it('gives each robot kind its own shape, never colour alone', () => {
    expect(new Set(['n', 'f', 'h'].map(shapeOf)).size).toBe(3);
  });

  it('rings the caught player only once the catch happens', () => {
    const endMs = timelineEndMs(CAUGHT.tracks);
    const start = draw({ turn: CAUGHT, atMs: 0 }).calls.get('drawRRect') ?? 0;
    const end = draw({ turn: CAUGHT, atMs: endMs }).calls.get('drawRRect') ?? 0;
    expect(end).toBe(start + 1);
  });

  it('flashes the caught square red while the catch plays', () => {
    const caught = CAUGHT.tracks.find((track) => track.channel === 'caught');
    const settled = draw({ turn: CAUGHT, atMs: timelineEndMs(CAUGHT.tracks) });
    const flash = draw({ turn: CAUGHT, atMs: (caught?.startMs ?? 0) + 50 });
    expect(flash.calls.get('drawRRect')).toBe((settled.calls.get('drawRRect') ?? 0) + 1);
  });

  it('pulses a ring around the player while they wait', () => {
    const turn = turnOf(
      [
        'n.......',
        '........',
        '........',
        '...@....',
        '........',
        '........',
        '........',
        '........',
      ],
      { kind: 'wait' },
    );
    const end = draw({ turn, atMs: timelineEndMs(turn.tracks) });
    const pulse = draw({ turn, atMs: 50 });
    expect(pulse.calls.get('drawCircle')).toBe((end.calls.get('drawCircle') ?? 0) + 1);
  });

  it('glows over the floor with a burst when it is cleared, and blinks once for an undo', () => {
    const { view } = turnOf(['n.n.', '....', '....', '.@..'], { kind: 'wait' });
    const settled = draw({ turn: { view, tracks: [] }, atMs: 0 });
    const glowing = draw({
      turn: { view, tracks: buildTimeline([{ kind: 'floor-cleared' }], 'full') },
      atMs: 200,
    });
    const blinking = draw({
      turn: { view, tracks: buildTimeline([{ kind: 'step-reverted' }], 'full') },
      atMs: 50,
    });
    const counts = (recorded: Recorded): number[] =>
      ['drawRRect', 'drawCircle'].map((name) => recorded.calls.get(name) ?? 0);
    const [rrects = 0, circles = 0] = counts(settled);
    expect([counts(glowing), counts(blinking)]).toStrictEqual([
      [rrects + 1, circles + 18],
      [rrects + 1, circles],
    ]);
  });

  it('rings each hinted square of the host highlight', () => {
    const turn = idle(['n...', '....', '..@.', '....']);
    const hinted = [{ regionId: 'board', col: 1, row: 1 }];
    const plain = draw({ turn, atMs: 0 });
    const withHint = draw({ turn, atMs: 0, highlight: { selected: null, hinted } });
    expect(withHint.calls.get('drawRRect')).toBe((plain.calls.get('drawRRect') ?? 0) + 1);
  });

  it('draws only the background before the canvas has a size', () => {
    const { canvas, recorded } = recordingCanvas();
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    const layout = { width: 0, height: 0, isMirrored: false, regions: [] };
    const frame = {
      view: BUSY.view,
      fx,
      highlight: EMPTY_HIGHLIGHT,
      colors: COLORS,
      layout,
      kit: KIT,
    };
    drawBoard(canvas, frame);
    expect([...recorded.calls.keys()]).toStrictEqual(['drawColor']);
  });
});

/** A paint that remembers its alpha the way Skia does: setColor takes the colour's, setAlphaf replaces it. */
function alphaPaint(): { paint: SkPaint; alpha: () => number } {
  let alpha = 1;
  const paint = new Proxy(
    {},
    {
      get: (_target, name) => (value: unknown) => {
        if (name === 'setColor') alpha = (value as SkColor)[3] ?? 1;
        if (name === 'setAlphaf') alpha = value as number;
      },
    },
  ) as SkPaint;
  return { paint, alpha: () => alpha };
}

/** The highest alpha any fill or stroke draw used on a frame where every token is half transparent. */
function highestAlpha(at: DrawAt): number {
  const fill = alphaPaint();
  const stroke = alphaPaint();
  let highest = 0;
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, _name) =>
        (...args: unknown[]) => {
          const paint = args.at(-1);
          if (paint === fill.paint) highest = Math.max(highest, fill.alpha());
          if (paint === stroke.paint) highest = Math.max(highest, stroke.alpha());
        },
    },
  ) as SkCanvas;
  const half = new Float32Array([0, 0, 0, 0.5]) as SkColor;
  const color = Object.fromEntries(TOKENS.map((token) => [token, half]));
  const colors = { ...COLORS, color: color as Record<BoardToken, SkColor> };
  const { view, tracks } = at.turn;
  const fx = { ...sampleTimeline(tracks, at.atMs), pointer: IDLE_POINTER };
  const layout = layoutBoard({ width: 390, height: 560, view, isMirrored: false });
  const kit = { ...KIT, fill: fill.paint, stroke: stroke.paint };
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  drawBoard(canvas, { view, fx, highlight, colors, layout, kit });
  return highest;
}

describe('drawBoard with a translucent token', () => {
  // spec 8.12: the board draws from its palette tokens, so a fade multiplies a token's own alpha.
  it('keeps a half-transparent token at or below its own alpha on every frame', () => {
    const { view } = turnOf(['n.n.', '....', '....', '.@..'], { kind: 'wait' });
    const wait = turnOf(['n...', '....', '....', '...@'], { kind: 'wait' });
    const turns: Turn[] = [
      BUSY,
      CAUGHT,
      wait,
      { view, tracks: buildTimeline([{ kind: 'floor-cleared' }], 'full') },
      { view, tracks: buildTimeline([{ kind: 'step-reverted' }], 'full') },
    ];
    const frames: DrawAt[] = turns.flatMap((turn) =>
      Array.from({ length: 13 }, (_, i) => ({ turn, atMs: (timelineEndMs(turn.tracks) * i) / 12 })),
    );
    const hinted = { selected: null, hinted: [{ regionId: 'board', col: 1, row: 1 }] };
    frames.push({ turn: idle(['n...', '....', '..@.', '....']), atMs: 0, highlight: hinted });
    expect(Math.max(...frames.map(highestAlpha))).toBeLessThanOrEqual(0.5);
  });
});
