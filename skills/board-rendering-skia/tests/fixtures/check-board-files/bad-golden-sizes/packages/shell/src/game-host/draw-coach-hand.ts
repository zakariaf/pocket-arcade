// packages/shell/src/game-host/draw-coach-hand.ts
'worklet';

// The tutorial's pointing hand (spec S13: "the game guides the first moves with a pointing hand"),
// drawn by the Shell over any game's board picture, so every game gets the same pointer. It glides
// from the drag's start (a tray slot) to the gap and holds there, its fingertip pointing up into
// the gap's lowest cell, so the hand below the tip never hides the cells to fill. Pure worklet:
// reads only its arguments, allocates no Skia objects, reads no clock (the phase comes in).
import { cellRect, isSameTarget } from '@e07/game-kit/geom/board-layout.ts';

import type { RenderKit } from './board-types.ts';
import type { BoardLayout, BoardTarget, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkColor } from '@shopify/react-native-skia';

/** The pointing hand: from where it starts (a drag's slot; null for a plain target) to its end. */
export type CoachHand = { readonly from: BoardTarget | null; readonly to: BoardTarget };

/** Where the fingertip is (x, y: the top of the finger) and the hand's size (the end cell's). */
export type HandPose = { readonly x: number; readonly y: number; readonly size: number };

/** One glide and hold of the hand, and how many it plays each time it is shown or replayed. */
export const COACH_HAND_LOOP_MS = 1600;
export const COACH_HAND_LOOPS = 3;

/**
 * What restarts the hand's animation: another hand, or the same hand asked to play again (its
 * replay count). Null while there is no hand.
 */
export function coachHandKey(
  coach: { readonly hand: CoachHand; readonly replay: number } | null,
): string | null {
  if (coach === null) return null;
  const { from, to } = coach.hand;
  const at = (target: BoardTarget | null): string =>
    target === null ? '-' : `${target.regionId}:${String(target.col)}:${String(target.row)}`;
  return `${at(from)}>${at(to)}#${String(coach.replay)}`;
}

/** The share of a loop the glide takes; the hand then holds at the gap. */
const GLIDE_SHARE = 0.6;
/** How far the fingertip reaches into the gap's lowest cell, as a share of the cell. */
const TIP_REACH = 0.3;

type HandCoach = { readonly hand: CoachHand; readonly cells: readonly BoardTarget[] };

/** The rect around the cells the move fills (the pointer's end cell when the move names none). */
function gapRect(layout: BoardLayout, coach: HandCoach): Rect | null {
  const { from, to } = coach.hand;
  const filled = coach.cells.filter((target) => !isSameTarget(target, from));
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const target of filled.length === 0 ? [to] : filled) {
    const rect = cellRect(layout, target);
    if (rect === null) continue;
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return left === Infinity ? null : { x: left, y: top, width: right - left, height: bottom - top };
}

/** Smoothstep of the glide's share of the loop: 0 at the start, 1 from GLIDE_SHARE on. */
function glideOf(phase: number): number {
  const t = Math.max(0, Math.min(1, phase / GLIDE_SHARE));
  return t * t * (3 - 2 * t);
}

/** The hand at `phase` (0..1 of one loop), or null before the board has a size. */
export function coachHandPose(
  layout: BoardLayout,
  coach: HandCoach,
  phase: number,
): HandPose | null {
  const gap = gapRect(layout, coach);
  const end = cellRect(layout, coach.hand.to);
  if (gap === null || end === null) return null;
  const size = end.width;
  const tip = { x: gap.x + gap.width / 2, y: gap.y + gap.height - size * TIP_REACH };
  const from = coach.hand.from === null ? null : cellRect(layout, coach.hand.from);
  if (from === null) return { ...tip, size };
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const t = glideOf(phase);
  return { x: start.x + (tip.x - start.x) * t, y: start.y + (tip.y - start.y) * t, size };
}

/** The hand's colours: the theme's pop paint and the ink drawn on it (onPop), in both schemes. */
export type CoachHandLook = { readonly fill: SkColor; readonly ink: SkColor };

export type CoachHandFrame = HandCoach & {
  readonly phase: number;
  readonly look: CoachHandLook;
  readonly layout: BoardLayout;
  readonly kit: Pick<RenderKit, 'fill' | 'stroke'>;
};

/** One rounded part of the hand, as shares of the hand size from the fingertip. */
type Part = {
  readonly dx: number;
  readonly dy: number;
  readonly width: number;
  readonly height: number;
};

/** Palm, thumb, then the index finger on top, its tip at the pose (pointing up). */
const PARTS: readonly Part[] = [
  { dx: -0.2, dy: 0.45, width: 0.62, height: 0.5 },
  { dx: -0.38, dy: 0.52, width: 0.3, height: 0.22 },
  { dx: -0.14, dy: 0, width: 0.28, height: 0.62 },
];

export function drawCoachHand(canvas: SkCanvas, frame: CoachHandFrame): void {
  const pose = coachHandPose(frame.layout, frame, frame.phase);
  if (pose === null) return;
  const { fill, stroke } = frame.kit;
  const s = pose.size;
  fill.setColor(frame.look.fill);
  stroke.setColor(frame.look.ink);
  stroke.setStrokeWidth(Math.max(1.5, s * 0.06));
  for (const part of PARTS) {
    const rect = {
      x: pose.x + part.dx * s,
      y: pose.y + part.dy * s,
      width: part.width * s,
      height: part.height * s,
    };
    const r = Math.min(rect.width, rect.height) / 2;
    canvas.drawRRect({ rect, rx: r, ry: r }, fill);
    canvas.drawRRect({ rect, rx: r, ry: r }, stroke);
  }
}
