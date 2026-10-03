// packages/game-kit/src/contract/persistence.ts
/** When a real-time game's run is written. Never per frame. */
export type SavePoint = 'wave-end' | 'turn-end' | 'pause' | 'background' | 'level-end';

export type SavePolicy =
  | { readonly kind: 'after-every-move' }
  | { readonly kind: 'save-points'; readonly points: readonly SavePoint[] };

/**
 * How the in-progress run lives inside the Shell's save document. The Shell owns the
 * document; the game owns the shape of its state and moves (both JSON-serialisable).
 */
export type PersistenceSpec<TState, TMove> = {
  /** Bump when the shape of TState or TMove changes; add a migrateState step. */
  readonly stateVersion: number;
  /** Validates JSON from disk; null = invalid (the run is dropped, results are kept). */
  readonly parseState: (json: unknown) => TState | null;
  /** Validates one logged move before replay; null = undo history dropped. */
  readonly parseMove: (json: unknown) => TMove | null;
  /** Upgrades an older run state; null = cannot (the run is dropped, results are kept). */
  readonly migrateState: (json: unknown, fromVersion: number) => TState | null;
  readonly savePolicy: SavePolicy;
};
