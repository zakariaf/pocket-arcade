// packages/shell/src/game-host/game-session-store.ts
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { gameSessionReducer } from '@e07/shell/game-host/game-session-reducer.ts';

import type {
  GameSession,
  SessionAction,
  SessionRules,
} from '@e07/shell/game-host/game-session-types.ts';
import type { StoreApi } from 'zustand/vanilla';

export type GameSessionStoreState<TState, TMove, TEvent> = {
  readonly session: GameSession<TState, TMove, TEvent>;
  readonly dispatch: (action: SessionAction<TMove>) => void;
};

export type GameSessionStore<TState, TMove, TEvent> = StoreApi<
  GameSessionStoreState<TState, TMove, TEvent>
>;

/** Called with every CHANGED session before it is published (and so before it is animated). */
export type PersistSession<TState, TMove, TEvent> = (
  session: GameSession<TState, TMove, TEvent>,
  action: SessionAction<TMove>,
) => void;

export type GameSessionStoreInput<TState, TMove, TEvent> = {
  readonly rules: SessionRules<TState, TMove, TEvent>;
  /** startGameSession(...) for a new run, or restoreRun(...).session for a saved one. */
  readonly initial: GameSession<TState, TMove, TEvent>;
  readonly persist: PersistSession<TState, TMove, TEvent>;
};

/**
 * One store per run, created by the game host (never a module singleton). Thin:
 * reduce -> persist -> publish, so a kill during an animation loses nothing.
 */
export function createGameSessionStore<TState, TMove, TEvent>(
  input: GameSessionStoreInput<TState, TMove, TEvent>,
): GameSessionStore<TState, TMove, TEvent> {
  const { rules, initial, persist } = input;
  return createStore<GameSessionStoreState<TState, TMove, TEvent>>()((set, get) => ({
    session: initial,
    dispatch: (action) => {
      const current = get().session;
      const next = gameSessionReducer(rules, current, action);
      if (next === current) return; // ignored action (paused, finished, no undo left)
      persist(next, action);
      set({ session: next });
    },
  }));
}

/** Always pass a selector: `useGameSession(store, (state) => state.session.moveCount)`. */
export function useGameSession<TState, TMove, TEvent, TSlice>(
  store: GameSessionStore<TState, TMove, TEvent>,
  selector: (state: GameSessionStoreState<TState, TMove, TEvent>) => TSlice,
): TSlice {
  return useStore(store, selector);
}
