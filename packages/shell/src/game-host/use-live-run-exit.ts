// packages/shell/src/game-host/use-live-run-exit.ts
// The Game screen's side of the test build's live-run exit (live-run-exit.ts): while its run is
// live it offers its leave (Pause -> Home) to the exit, so a debug link's stack reset leaves first.
import { use, useEffect } from 'react';

import { LiveRunExitContext } from './live-run-exit.ts';

/** Offers the Game screen's leave to the test build's exit while its run is live (leave null otherwise). */
export function useLiveRunExit(leave: (() => void) | null): void {
  const exit = use(LiveRunExitContext);
  // Allowed effect: registers with the debug link's exit, an outside system that calls it.
  useEffect(
    () => (exit === null || leave === null ? undefined : exit.register(leave)),
    [exit, leave],
  );
}
