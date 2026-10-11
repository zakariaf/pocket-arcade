// packages/shell/src/game-host/use-game-session-controls.ts
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';

import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';

import type { BoardHostProps, GameHost, OpenedSession } from '@e07/shell/game-host/game-host.ts';
import type { SessionStatus } from '@e07/shell/game-host/game-session-types.ts';
import type { SessionCommand, SessionView } from '@e07/shell/game-host/session-view.ts';
import type { GameParams } from '@e07/shell/navigation/route-params.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';
import type { ComponentType } from 'react';

/** What the Game screen (S5) and its overlays use; no game type appears here. */
export type GameSessionControls = {
  /** 'missing': there was no run to open (no saved run, unknown level); leave to Home. */
  readonly status: SessionStatus | 'missing';
  readonly view: SessionView | null;
  readonly BoardHost: ComponentType<BoardHostProps> | null;
  readonly send: (command: SessionCommand) => void;
  readonly pause: () => void;
  readonly resume: () => void;
  /** Pause -> Home: the run stays saved with resumeOnLaunch false, so a relaunch lands on Home. */
  readonly leaveToHome: () => void;
  /**
   * Next level, Replay, Try again, Restart level: a new run in the same Game screen (no
   * navigation). A loss still waiting for its continue is recorded first.
   */
  readonly startRun: (ref: RunRef) => void;
  /** A paid hint would show a move now: the Game screen asks before the player pays (spec 8.5). */
  readonly canHint: () => boolean;
};

const noSubscription = (): (() => void) => () => undefined;
const noView = (): null => null;

/**
 * Test builds: a parity capture of a game frame (S5 under S6, S6, S7) shows the design's numbers
 * in the top bar, then opens the frame's state through the handler a player's tap would use:
 * Pause through pause, a result through the host's fixture result (nothing is saved). The fixture
 * follows the game's facts: a score-rated game gets par null, so S5 shows its own progress line and
 * the S7 win prints the score line. The board-layout probe launch opens no state. Store builds
 * (TEST_ONLY null) skip all of it.
 */
function openParityFrame(host: GameHost, opened: OpenedSession): void {
  const api = TEST_ONLY;
  const fixture = api?.parityGameFixture({ isScoreRated: host.isScoreRated }) ?? null;
  if (api === null || fixture === null || api.isParityBoardProbeOn()) return;
  const controls = host.debugControls();
  controls.applyFixtureHud(fixture);
  const state = api.parityFrameState();
  if (state === 'pause-open') opened.handle.send({ type: 'pause' });
  if (state === 'result-win') controls.showFixtureResult(fixture, 'won');
  if (state === 'result-lose') controls.showFixtureResult(fixture, 'lost');
}

type OpenedRun = readonly [OpenedSession | null, (next: OpenedSession | null) => void];

/**
 * The run of one Game screen: opened once for its route params. New params for the open screen
 * (popTo('Game', params): S13's "Play the tutorial again" from Pause) open their run in place, as
 * startRun does, so a second Game screen never stacks over the first.
 */
function useOpenedRun(host: GameHost, params: GameParams): OpenedRun {
  const [opened, setOpened] = useState<OpenedSession | null>(() => {
    const first = host.openSession(params);
    if (first !== null) openParityFrame(host, first);
    return first;
  });
  // Compared by value: a caller may pass equal params as a new object on every render.
  const paramsKey = JSON.stringify(params);
  const openedFor = useRef(paramsKey);
  const reopen = useEffectEvent(() => {
    opened?.handle.send({ type: 'finish' });
    setOpened(host.openSession(params));
  });
  // Allowed effect: follows the navigator's route params, an outside system, into the open run.
  useEffect(() => {
    if (openedFor.current === paramsKey) return;
    openedFor.current = paramsKey;
    reopen();
  }, [paramsKey]);
  return [opened, setOpened];
}

/** Opens the run for these route params (useOpenedRun) and follows its view. */
export function useGameSessionControls(params: GameParams): GameSessionControls {
  const host = useGameHost();
  const [opened, setOpened] = useOpenedRun(host, params);
  const view = useSyncExternalStore(
    opened?.handle.subscribe ?? noSubscription,
    opened?.handle.getView ?? noView,
  );
  const send = (command: SessionCommand): void => {
    opened?.handle.send(command);
  };
  return {
    status: view?.status ?? 'missing',
    view,
    BoardHost: opened?.BoardHost ?? null,
    send,
    pause: () => {
      send({ type: 'pause' });
    },
    resume: () => {
      send({ type: 'resume' });
    },
    leaveToHome: () => {
      send({ type: 'leave' });
    },
    startRun: (ref) => {
      send({ type: 'finish' });
      setOpened(host.openSession({ start: 'new', ref }));
    },
    canHint: () => opened?.canHint() ?? false,
  };
}
