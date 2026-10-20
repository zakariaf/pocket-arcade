// apps/scrap-shove/src/board/draw-heaps.ts
'worklet';

import { fxEntry, trackKey } from '@e07/game-kit/timeline/sample.ts';

import { centred, trackedSquare } from './board-geometry.ts';
import { heapEntity } from './board-ids.ts';

import type { Frame } from './board-geometry.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const HEAP_SIZE = 0.74;
const EDGE = 0.05;

/** A heap to draw: where it is, how grown (a new heap pops in) and how solid (a smashed heap fades). */
type HeapShape = { readonly square: Rect; readonly scale: number; readonly alpha: number };

/** A point of the block, as shares of its width and height. */
function at(block: Rect, x: number, y: number): readonly [number, number] {
  return [block.x + block.width * x, block.y + block.height * y];
}

/** A scrap heap: a battered block with a dent line and two rivets (a shape, never colour alone). */
function drawHeap(canvas: SkCanvas, frame: Frame, heap: HeapShape): void {
  const { kit, colors } = frame;
  const block = centred(heap.square, HEAP_SIZE * heap.scale);
  const corner = block.width * 0.12;
  const rivet = block.width * 0.07;
  kit.fill.setColor(colors.color.heap);
  kit.fill.setAlphaf(heap.alpha);
  canvas.drawRRect({ rect: block, rx: corner, ry: corner }, kit.fill);
  kit.stroke.setColor(colors.color.frame);
  kit.stroke.setAlphaf(heap.alpha);
  kit.stroke.setStrokeWidth(Math.max(1, heap.square.width * EDGE));
  canvas.drawRRect({ rect: block, rx: corner, ry: corner }, kit.stroke);
  kit.stroke.setColor(colors.color.heapMark);
  kit.stroke.setAlphaf(heap.alpha);
  canvas.drawLine(...at(block, 0.22, 0.3), ...at(block, 0.78, 0.7), kit.stroke);
  kit.fill.setColor(colors.color.heapMark);
  kit.fill.setAlphaf(heap.alpha);
  canvas.drawCircle(...at(block, 0.26, 0.74), rivet, kit.fill);
  canvas.drawCircle(...at(block, 0.74, 0.26), rivet, kit.fill);
  kit.fill.setAlphaf(1);
  kit.stroke.setAlphaf(1);
}

/** The heaps of the final view, sliding where a shove moves them and popping in where robots crashed. */
export function drawHeaps(canvas: SkCanvas, frame: Frame): void {
  for (const heap of frame.view.heaps) {
    const entity = heapEntity(heap.id);
    const square = trackedSquare(frame, trackKey('heap', entity), [heap.col, heap.row]);
    const scale = fxEntry(frame.fx, 'appear', entity)?.values[0] ?? 1;
    if (square !== null && scale > 0) drawHeap(canvas, frame, { square, scale, alpha: 1 });
  }
}

/** Heaps a heavy robot smashed are gone from the view: their smash tracks carry them as they fade. */
export function drawSmashedHeaps(canvas: SkCanvas, frame: Frame): void {
  for (const key of Object.keys(frame.fx.entries)) {
    const smash = frame.fx.entries[key];
    if (!key.startsWith('smash:') || smash === undefined) continue;
    const alpha = smash.values[2] ?? 0;
    // A heap the player shoved earlier in the turn slides to where it is smashed.
    const square = trackedSquare(frame, `heap:${key.slice('smash:'.length)}`, smash.values);
    if (square !== null && alpha > 0) drawHeap(canvas, frame, { square, scale: 1, alpha });
  }
}
