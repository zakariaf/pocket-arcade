// packages/shell/src/game-host/draw-coach-hand.test.ts
import { coachHandKey, coachHandPose, drawCoachHand } from './draw-coach-hand.ts';

import type { CoachHandFrame } from './draw-coach-hand.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkColor, SkPaint, SkRRect } from '@shopify/react-native-skia';

/** A 4 x 4 board of 40 pt cells at (10, 10), and a 3-slot tray of 60 pt slots below it. */
const LAYOUT: BoardLayout = {
  width: 200,
  height: 260,
  isMirrored: false,
  regions: [
    { id: 'board', x: 10, y: 10, cell: 40, cols: 4, rows: 4 },
    { id: 'tray', x: 10, y: 190, cell: 60, cols: 3, rows: 1 },
  ],
};
const SLOT: BoardTarget = { regionId: 'tray', col: 1, row: 0 };
const cell = (col: number, row: number): BoardTarget => ({ regionId: 'board', col, row });
/** A vertical two dropped on column 3, rows 1 and 2: the slot and both cells it fills. */
const DRAG = { hand: { from: SLOT, to: cell(3, 1) }, cells: [SLOT, cell(3, 1), cell(3, 2)] };

describe('coachHandPose', () => {
  it('starts on the slot and ends pointing up into the gap from below its last cell', () => {
    // Spec S13: "a pointing hand", here a drag from the tray slot to the gap. The fingertip ends
    // inside the gap's lowest cell, so the hand below it never hides the gap's other cells.
    expect(coachHandPose(LAYOUT, DRAG, 0)).toStrictEqual({ x: 100, y: 220, size: 40 });
    expect(coachHandPose(LAYOUT, DRAG, 1)).toStrictEqual({ x: 150, y: 118, size: 40 });
  });

  it('glides between the two, then holds at the gap for the rest of the loop', () => {
    const half = coachHandPose(LAYOUT, DRAG, 0.3);
    expect(half?.x).toBeCloseTo(125, 6);
    expect(half?.y).toBeCloseTo(169, 6);
    expect(coachHandPose(LAYOUT, DRAG, 0.6)).toStrictEqual(coachHandPose(LAYOUT, DRAG, 1));
    expect(coachHandPose(LAYOUT, DRAG, 0.8)).toStrictEqual(coachHandPose(LAYOUT, DRAG, 1));
  });

  it('points at a plain target from below, and has no pose before the board has a size', () => {
    const target = { hand: { from: null, to: cell(0, 0) }, cells: [cell(0, 0)] };
    expect(coachHandPose(LAYOUT, target, 0)).toStrictEqual({ x: 30, y: 38, size: 40 });
    const empty = { width: 0, height: 0, isMirrored: false, regions: [] };
    expect(coachHandPose(empty, DRAG, 1)).toBeNull();
  });
});

describe('drawCoachHand', () => {
  function drawn(phase: number, layout: BoardLayout = LAYOUT): SkRRect[] {
    const rrects: SkRRect[] = [];
    const methods: Record<string, unknown> = {
      drawRRect: (rrect: SkRRect) => rrects.push(rrect),
    };
    const canvas = new Proxy({}, { get: (_t, name) => methods[String(name)] ?? (() => undefined) });
    const paint = new Proxy({}, { get: () => () => undefined }) as SkPaint;
    const color = new Float32Array([1, 1, 1, 1]) as SkColor;
    const frame: CoachHandFrame = {
      ...DRAG,
      phase,
      look: { fill: color, ink: color },
      layout,
      kit: { fill: paint, stroke: paint },
    };
    drawCoachHand(canvas as SkCanvas, frame);
    return rrects;
  }

  it('draws the finger, palm and thumb, each filled and outlined, with the fingertip on top', () => {
    const rrects = drawn(1);
    expect(rrects).toHaveLength(6);
    const finger = rrects.at(-1)?.rect;
    expect(finger?.x).toBeCloseTo(150 - 0.14 * 40, 6);
    expect(finger?.y).toBeCloseTo(118, 6);
    expect(Math.min(...rrects.map((rrect) => rrect.rect.y))).toBeCloseTo(118, 6);
  });

  it('draws nothing before the board has a size', () => {
    expect(drawn(1, { width: 0, height: 0, isMirrored: false, regions: [] })).toStrictEqual([]);
  });
});

describe('coachHandKey', () => {
  it('restarts the glide for another hand or a replay of the same one, never for nothing', () => {
    const first = coachHandKey({ hand: DRAG.hand, replay: 0 });
    expect(first).toBe('tray:1:0>board:3:1#0');
    expect(coachHandKey({ hand: DRAG.hand, replay: 1 })).not.toBe(first);
    expect(coachHandKey({ hand: { from: null, to: cell(0, 0) }, replay: 0 })).toBe('->board:0:0#0');
    expect(coachHandKey(null)).toBeNull();
  });
});
