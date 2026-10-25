// packages/shell/src/game-host/draw-coach-hand.ts
'worklet';

// The tutorial's pointing hand (spec S13: "the game guides the first moves with a pointing hand"),
// drawn by the Shell over any game's board, so every game gets the same pointer. It glides from
// the drag's start (a tray slot) to the gap and holds there, its fingertip pointing up into the
// gap's lowest cell, so the hand below the tip never hides the cells to fill. Its glide is worked
// out once per layout and cells (coachHandGlide); each frame only places the hand on it. Pure
// worklet: reads only its arguments, allocates no Skia objects, reads no clock (the phase comes in).
import { cellRect, isSameTarget } from '@e07/game-kit/geom/board-layout.ts';

import type { RenderKit } from './board-types.ts';
import type { BoardLayout, BoardTarget, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { Motion } from '@e07/game-kit/timeline/track.ts';
import type { SkCanvas, SkColor } from '@shopify/react-native-skia';

/** The pointing hand: from where it starts (a drag's slot; null for a plain target) to its end. */
export type CoachHand = { readonly from: BoardTarget | null; readonly to: BoardTarget };

/** The hand's colours: the theme's pop paint and the ink drawn on it (onPop), in both schemes. */
export type CoachHandLook = { readonly fill: SkColor; readonly ink: SkColor };

/** Where the board draws a target (GameBoard.targetRect, else cellRect). Worklet. */
export type TargetRect = (layout: BoardLayout, target: BoardTarget) => Rect | null;

/**
 * The hand a board draws: its path, the cells its move fills (the gap it points into), its look,
 * and where the board draws each target (the slot may lie off its grid cell).
 */
export type BoardCoachHand = {
  readonly hand: CoachHand;
  readonly cells: readonly BoardTarget[];
  readonly look: CoachHandLook;
  readonly targetRect: TargetRect;
};

/** Where the fingertip is (x, y: the top of the finger) and the hand's size (the end cell's). */
export type HandPose = { readonly x: number; readonly y: number; readonly size: number };

/** The hand's glide on one layout: from the slot's centre (null: it only points) to its rest. */
export type CoachHandGlide = {
  readonly start: { readonly x: number; readonly y: number } | null;
  readonly rest: HandPose;
};

/** What the hand is drawn with: its glide (null before the board has a size), look and paints. */
export type CoachHandDraw = {
  readonly glide: CoachHandGlide | null;
  readonly look: CoachHandLook;
  readonly kit: Pick<RenderKit, 'fill' | 'stroke'>;
};

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

/** Whether the hand's phase animates: only a drag's hand glides, and never under reduced motion. */
export function isCoachHandGliding(hand: CoachHand, motion: Motion): boolean {
  return hand.from !== null && motion !== 'reduced';
}

/** The share of a loop the glide takes; the hand then holds at the gap. */
const GLIDE_SHARE = 0.6;
/** How far the fingertip reaches into the gap's lowest cell, as a share of the cell. */
const TIP_REACH = 0.3;

/** The hand's path and cells; targetRect defaults to cellRect (a board that draws on its grid). */
type HandPath = Pick<BoardCoachHand, 'hand' | 'cells'> & { readonly targetRect?: TargetRect };

/** The rect around the cells the move fills (the pointer's end cell when the move names none). */
function gapRect(layout: BoardLayout, coach: HandPath): Rect | null {
  const { from, to } = coach.hand;
  const rectOf = coach.targetRect ?? cellRect;
  const filled = coach.cells.filter((target) => !isSameTarget(target, from));
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const target of filled.length === 0 ? [to] : filled) {
    const rect = rectOf(layout, target);
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

/**
 * The hand's glide on `layout`, each target where the board draws it: from the slot's centre to the fingertip's rest, TIP_REACH inside
 * the gap's lowest cell. Null before the board has a size. Worked out once per layout and cells.
 */
export function coachHandGlide(layout: BoardLayout, coach: HandPath): CoachHandGlide | null {
  const rectOf = coach.targetRect ?? cellRect;
  const gap = gapRect(layout, coach);
  const end = rectOf(layout, coach.hand.to);
  if (gap === null || end === null) return null;
  const size = end.width;
  const rest = { x: gap.x + gap.width / 2, y: gap.y + gap.height - size * TIP_REACH, size };
  const from = coach.hand.from === null ? null : rectOf(layout, coach.hand.from);
  const start = from === null ? null : { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  return { start, rest };
}

/** The hand at `phase` (0..1 of one loop) on its glide. */
function poseOn(glide: CoachHandGlide, phase: number): HandPose {
  const { start, rest } = glide;
  if (start === null) return rest;
  const t = glideOf(phase);
  return {
    x: start.x + (rest.x - start.x) * t,
    y: start.y + (rest.y - start.y) * t,
    size: rest.size,
  };
}

/** The hand at `phase` (0..1 of one loop), or null before the board has a size. */
export function coachHandPose(
  layout: BoardLayout,
  coach: HandPath,
  phase: number,
): HandPose | null {
  const glide = coachHandGlide(layout, coach);
  return glide === null ? null : poseOn(glide, phase);
}

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

/** Draws the hand at `phase` (0..1 of one loop); nothing before the board has a size. */
export function drawCoachHand(canvas: SkCanvas, hand: CoachHandDraw, phase: number): void {
  if (hand.glide === null) return;
  const pose = poseOn(hand.glide, phase);
  const { fill, stroke } = hand.kit;
  const s = pose.size;
  fill.setColor(hand.look.fill);
  stroke.setColor(hand.look.ink);
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
