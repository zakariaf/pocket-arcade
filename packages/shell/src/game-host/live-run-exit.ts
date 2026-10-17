// packages/shell/src/game-host/live-run-exit.ts
// The open Game screen's way out of its live run, for a test build's debug link. Back never leaves
// a live run (spec S5, S6): the Game screen lets a removal through only once it has left the run
// itself (Pause -> Home), so a stack reset that does not leave first is guarded like Back. A debug
// link resets the stack to open its screen (app/debug-link-routes.ts, resetToFirstRoute): it leaves
// through this exit first, exactly as Pause -> Home does. The exit exists only in a test build:
// createDebugParts makes it and ShellNavigator provides it; a store build provides none, so the
// Game screen registers nowhere and no registry exists. The Game screen offers its leave through
// use-live-run-exit.ts.
import { createContext } from 'react';

export type LiveRunExit = {
  /** The Game screen's leave while its run is live; returns the call that takes it back. */
  readonly register: (leave: () => void) => () => void;
  /** Leaves the open Game screen's live run, if there is one. */
  readonly leave: () => void;
};

/** One test build's exit: one Game screen is open at a time (every way back to it uses popTo). */
export function createLiveRunExit(): LiveRunExit {
  let current: (() => void) | null = null;
  return {
    register: (leave) => {
      current = leave;
      return () => {
        if (current === leave) current = null;
      };
    },
    leave: () => {
      current?.();
    },
  };
}

/** The test build's exit (DebugParts.liveRunExit); null in a store build. */
export const LiveRunExitContext = createContext<LiveRunExit | null>(null);
