// packages/game-kit/src/contract/testing.ts
import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';

/** States for the screenshot matrix, the debug menu and E2E setup (spec 10 TESTING). */
export type ExampleStateId = 'start' | 'middle' | 'win' | 'lose';

export type TestingSpec<TState, TMove> = {
  /** A reasonable player for balance runs; randomPolicy() is the baseline. */
  readonly bot: BotPolicy<TState, TMove>;
  readonly examples: Readonly<Record<ExampleStateId, () => TState>>;
};
