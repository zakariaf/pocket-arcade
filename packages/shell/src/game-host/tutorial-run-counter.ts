// packages/shell/src/game-host/tutorial-run-counter.ts
// The tutorial runs a game host opened. S13's "Play the tutorial again" numbers its request with
// this count (GameParams.replay), so a replay asked from Pause during the tutorial is new route
// params for the open Game screen, which then starts the tutorial afresh instead of returning to
// the paused one (S6, S13). A request that opens no run counts nothing.
import type { SessionOpen } from '@e07/shell/game-host/open-session.ts';

export type CountedOpen<TOpened> = {
  readonly openSession: (open: SessionOpen) => TOpened | null;
  readonly tutorialRunCount: () => number;
};

/** Wraps the host's openSession so it counts every tutorial run it opened. */
export function countTutorialRuns<TOpened>(
  openSession: (open: SessionOpen) => TOpened | null,
): CountedOpen<TOpened> {
  let count = 0;
  return {
    openSession: (open) => {
      const opened = openSession(open);
      if (opened !== null && open.start === 'new' && open.ref.kind === 'tutorial') count += 1;
      return opened;
    },
    tutorialRunCount: () => count,
  };
}
