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

/** Appends a target unless it is the trace's last one (each change once, never null). */
function traced(trace: readonly BoardTarget[], target: BoardTarget | null): BoardTarget[] {
  return target === null || isSameTarget(trace.at(-1) ?? null, target)
    ? [...trace]
    : [...trace, target];
}

export function createDragPathTracer(): DragPathTracer {
  let trace: readonly BoardTarget[] = [];
  return {
    start: () => {
      trace = [];
    },
    hover: (target) => {
      trace = traced(trace, target);
    },
    finish: (intent) => {
      if (intent.kind !== 'drag-end') return intent;
      let path = [intent.from];
      for (const target of [...trace, intent.to]) path = traced(path, target);
      trace = [];
      return { ...intent, path };
    },
  };
}
