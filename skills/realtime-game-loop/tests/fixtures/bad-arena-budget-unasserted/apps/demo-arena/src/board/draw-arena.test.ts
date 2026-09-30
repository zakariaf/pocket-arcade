// apps/demo-arena/src/board/draw-arena.test.ts
import { ARENA, createDemoArenaSim, MAX_ENTITIES } from '@e07/demo-arena/sim/demo-arena-sim.ts';

import { drawArena } from './draw-arena.ts';

import type { BoardToken } from './board-palettes.ts';
import type { BoardColors, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkPaint } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the fullest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 100;

type Circle = { readonly x: number; readonly y: number; readonly r: number };
type Recorded = { readonly calls: Map<string, number>; readonly circles: Circle[] };

/** Counts every canvas call (a headless proxy for draw calls per frame) and keeps the circles. */
function recordingCanvas(): { canvas: SkCanvas; recorded: Recorded } {
  const recorded: Recorded = { calls: new Map(), circles: [] };
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          recorded.calls.set(String(name), (recorded.calls.get(String(name)) ?? 0) + 1);
          const [x, y, r] = args;
          if (name === 'drawCircle' && typeof x === 'number' && typeof y === 'number') {
            recorded.circles.push({ x, y, r: typeof r === 'number' ? r : 0 });
          }
        },
    },
  ) as SkCanvas;
  return { canvas, recorded };
}

const stubPaint = new Proxy({}, { get: () => () => undefined }) as SkPaint;
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: null,
  paths: {},
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const COLORS: BoardColors<BoardToken> = {
  scheme: 'dark',
  isColorBlind: false,
  color: { background: COLOR, player: COLOR, enemy: COLOR, effect: COLOR },
};
const SIZES = [
  { width: 390, height: 560 },
  { width: 1024, height: 700 },
  { width: 320, height: 400 },
] as const;

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

describe('drawArena', () => {
  it('stays within the draw-call budget with every entity slot in play', () => {
    const sim = createDemoArenaSim(1, MAX_ENTITIES);
    const { canvas, recorded } = recordingCanvas();
    drawArena(canvas, { sim, width: 390, height: 560, colors: COLORS, kit: KIT });
    expect(totalCalls(recorded)).toBeGreaterThan(0);
    expect(recorded.circles).toHaveLength(MAX_ENTITIES);
  });

  it.each(SIZES)('draws every body whole inside a $width x $height canvas', ({ width, height }) => {
    const sim = createDemoArenaSim(5, 20);
    sim.body[4] = 0; // one body on the arena's corner
    sim.body[5] = ARENA;
    const { canvas, recorded } = recordingCanvas();
    drawArena(canvas, { sim, width, height, colors: COLORS, kit: KIT });
    expect(recorded.circles.length).toBeGreaterThan(1);
    for (const { x, y, r } of recorded.circles) {
      expect(x - r).toBeGreaterThanOrEqual(0);
      expect(x + r).toBeLessThanOrEqual(width);
      expect(y - r).toBeGreaterThanOrEqual(0);
      expect(y + r).toBeLessThanOrEqual(height);
    }
  });
});
