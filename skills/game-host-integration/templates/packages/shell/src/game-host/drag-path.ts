// packages/shell/src/game-host/drag-path.ts
// The board host's trace of a drag (UI state, never a move): the gesture layer reports the drag's
// start and each change of the hovered target, and the drag-end intent leaves the host with the
// path the drag aimed along (InputIntent drag-end `path`). A game whose move is a path reads it:
// Jump Chain plays a loop chain that ends back on its own square, which a drop square alone cannot
// tell from a cancel. Plain data; the board host keeps one tracer per opened run.
import { isSameTarget } from '@e07/game-kit/geom/board-layout.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

export type DragPathTracer = {
  /** useBoardGestures onDragStart: a new drag, so the trace starts empty. */
  readonly start: () => void;
  /** useBoardGestures onHover: the drag now aims at this target (null: at no region). */
  readonly hover: (target: BoardTarget | null) => void;
  /** A drag-end gets the traced path; every other intent passes through unchanged. */
  readonly finish: (intent: InputIntent) => InputIntent;
};

/**
 * Appends a target to the trace in place unless it is the trace's last one (each change once,
 * never null), and returns the same array: a hover arrives on every change of the finger's target,
 * so the trace grows without being copied. Only this tracer holds a trace, and finish hands out a
 * path of its own, so nothing else sees the array change.
 */
export function traceTarget(trace: BoardTarget[], target: BoardTarget | null): BoardTarget[] {
  if (target !== null && !isSameTarget(trace.at(-1) ?? null, target)) trace.push(target);
  return trace;
}

export function createDragPathTracer(): DragPathTracer {
  let trace: BoardTarget[] = [];
  return {
    start: () => {
      trace = [];
    },
    hover: (target) => {
      traceTarget(trace, target);
    },
    finish: (intent) => {
      if (intent.kind !== 'drag-end') return intent;
      const path = [intent.from];
      for (const target of [...trace, intent.to]) traceTarget(path, target);
      trace = [];
      return { ...intent, path };
    },
  };
}
