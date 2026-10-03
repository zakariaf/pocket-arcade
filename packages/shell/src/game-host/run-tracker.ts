// packages/shell/src/game-host/run-tracker.ts
// The game host's record of its runs for the test-build debug controls: which opened run they act
// on (the last one, until it is left for Home; never the tutorial) and the example state an
// openExample call staged for the next new level-1 run.
import type { DebugRuns, StagedExample } from '@e07/shell/game-host/game-debug-controls.ts';
import type { SessionOpen } from '@e07/shell/game-host/open-session.ts';
import type { SessionController } from '@e07/shell/game-host/session-controller.ts';
import type { SessionHandle } from '@e07/shell/game-host/session-view.ts';
import type { ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';

type Controller<T extends ShellGameTypes> = SessionController<T['state'], T['move'], T['event']>;

export type RunTracker<T extends ShellGameTypes> = DebugRuns<T> & {
  /** The staged example for this open (only a new level-1 run takes it); dropped either way. */
  readonly take: (open: SessionOpen) => StagedExample<T> | null;
  /** The run the debug controls act on from now on; its handle forgets it on 'leave'. */
  readonly track: (controller: Controller<T>) => SessionHandle;
};

function isExampleRun(open: SessionOpen): boolean {
  return open.start === 'new' && open.ref.kind === 'level' && open.ref.level === 1;
}

export function createRunTracker<T extends ShellGameTypes>(): RunTracker<T> {
  let active: Controller<T> | null = null;
  let staged: StagedExample<T> | null = null;
  return {
    active: () => active,
    stage: (example) => {
      staged = example;
    },
    take: (open) => {
      const example = isExampleRun(open) ? staged : null;
      staged = null;
      return example;
    },
    track: (controller) => {
      const isTutorial = controller.store.getState().session.ref.kind === 'tutorial';
      active = isTutorial ? null : controller;
      const { handle } = controller;
      return {
        ...handle,
        send: (command) => {
          handle.send(command);
          if (command.type === 'leave' && active === controller) active = null;
        },
      };
    },
  };
}
