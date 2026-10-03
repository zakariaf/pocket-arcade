// packages/shell/src/game-host/use-board-selection.ts
// The board host's tap-then-tap selection and highlight (UI state, never a move): taps inside the
// engine's select regions pick a target, the next tap carries it to intentToMove, and any new
// eventSeq (a move applied, undone or continued, the run's end) clears it.
import { useState, useSyncExternalStore } from 'react';

import {
  highlightOf,
  hintedTargetsOf,
  routeIntent,
  selectedAt,
} from '@e07/shell/game-host/board-host-model.ts';
import { useGameSession } from '@e07/shell/game-host/game-session-store.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { BoardSelection } from '@e07/shell/game-host/board-host-model.ts';
import type { BoardHighlight } from '@e07/shell/game-host/board-types.ts';
import type { BoardHostInput } from '@e07/shell/game-host/game-host.ts';
import type { ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';

export type BoardSelectionInput<T extends ShellGameTypes> = Pick<
  BoardHostInput<T>,
  'game' | 'controller'
> & {
  /** Sends an intent to the run (boardHandlersFor(...).onIntent). */
  readonly send: (intent: InputIntent) => void;
  /** Speaks the change through VoiceOver: a target was picked, or the selection was dropped. */
  readonly announce: (change: 'selected' | 'unselected') => void;
  /** Tutorial: the coach pointer's cells, outlined with the hinted ones. */
  readonly coachTargets: readonly BoardTarget[];
};

export type BoardSelectionControls = {
  /** GameBoardHost's highlight prop: the selection and the hinted and coached targets. */
  readonly highlight: BoardHighlight;
  /** GameBoardHost's onIntent: routes taps through the selection first. */
  readonly onIntent: (intent: InputIntent) => void;
  /** Drops the selection (a tap outside every region). */
  readonly clearSelection: () => void;
};

/** The selection with the run it belongs to: a restarted run (a new store) starts without one. */
type HeldSelection = { readonly selection: BoardSelection; readonly run: object };

export function useBoardSelection<T extends ShellGameTypes>(
  input: BoardSelectionInput<T>,
): BoardSelectionControls {
  const { game, controller } = input;
  const seq = useGameSession(controller.store, (state) => state.session.eventSeq);
  const state = useGameSession(controller.store, (store) => store.session.state);
  // The hint lives in the controller: follow it through the handle, never a cached call.
  const hintedMove = useSyncExternalStore(controller.handle.subscribe, controller.hintedMove);
  const [held, setHeld] = useState<HeldSelection | null>(null);
  const selection = held?.run === controller.store ? held.selection : null;
  const selected = selectedAt(selection, seq);
  const hinted = hintedTargetsOf(game.presentation.board, state, hintedMove);
  return {
    highlight: highlightOf(selected, hinted, input.coachTargets),
    onIntent: (intent) => {
      const route = routeIntent({
        intent,
        selected,
        seq,
        selectRegions: game.engine.selectRegions,
      });
      setHeld(
        route.selection === null ? null : { selection: route.selection, run: controller.store },
      );
      if (route.announce !== null) input.announce(route.announce);
      if (route.intent !== null) input.send(route.intent);
    },
    clearSelection: () => {
      setHeld(null);
    },
  };
}
