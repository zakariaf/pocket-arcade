// packages/game-kit/src/contract/game-module.ts
import type { GameEngine } from '@e07/game-kit/contract/game-engine.ts';
import type { GameIdentity } from '@e07/game-kit/contract/game-identity.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';
import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { GameTexts } from '@e07/game-kit/contract/messages.ts';
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type { RealtimeSpec } from '@e07/game-kit/contract/realtime.ts';
import type { StatsSpec } from '@e07/game-kit/contract/stats.ts';
import type { TeachingSpec } from '@e07/game-kit/contract/teaching.ts';
import type { TestingSpec } from '@e07/game-kit/contract/testing.ts';

/**
 * Everything a game provides to become a complete app (spec section 10).
 * `TPresentation` carries the members whose types live in the Shell (Skia board, art,
 * sounds, UI palette), which game-kit may not import: the Shell binds it as
 * ShellGameModule (packages/shell/src/game-host/shell-game-module.ts).
 */
export type GameModule<TState, TMove, TEvent, TPresentation, TSim = never> = {
  readonly identity: GameIdentity;
  /** create · listMoves · applyMove · outcome · intentToMove · buildTimeline. */
  readonly engine: GameEngine<TState, TMove, TEvent>;
  readonly rules: GameRules<TState, TMove, TEvent>;
  readonly levels: LevelsSpec<TState, TMove>;
  readonly presentation: TPresentation;
  /** null for turn-based games (about 24 of 26). */
  readonly realtime: RealtimeSpec<TState, TSim> | null;
  readonly teaching: TeachingSpec<TState, TMove>;
  readonly stats: StatsSpec<TEvent>;
  readonly texts: GameTexts;
  readonly testing: TestingSpec<TState, TMove>;
  readonly persistence: PersistenceSpec<TState, TMove>;
};
