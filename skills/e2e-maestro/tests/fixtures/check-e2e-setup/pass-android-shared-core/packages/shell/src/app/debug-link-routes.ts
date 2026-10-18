// packages/shell/src/app/debug-link-routes.ts
// Pure: where a debug link's screen= goes. Routes are the navigator's own names; the four game
// example states belong to the game host, which knows how to build them.
import type { DebugScreen } from '@e07/shell/screens/debug/debug-link.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type DebugGameExample = 'game-start' | 'game-middle' | 'result-win' | 'result-lose';

/**
 * The game host's debug entry points: GameHost.debugControls() (game-host-integration) is this
 * type plus the parity fixture helpers, and create-shell-parts passes it to createDebugParts as
 * game. Test builds only (store builds get no debug parts).
 */
export type DebugGameControls = {
  /**
   * action=win-level|lose-level: swaps the active run's state for the game's testing.examples
   * win() or lose() (same ref) and runs the host's one run-end path (stars, statistics and ad
   * history saved before Result shows). Returns false, doing nothing, when no run is active; the
   * link handler then reports the link as an error.
   */
  readonly playTo: (outcome: 'won' | 'lost') => boolean;
  /**
   * screen=game-start|game-middle opens the Game route on a fresh level-1 run whose state is
   * testing.examples.start() or middle(); result-win|result-lose does the same, then playTo.
   */
  readonly openExample: (example: DebugGameExample) => void;
};

export type DebugRoute =
  | {
      readonly name:
        'Home' | 'Levels' | 'Daily' | 'Stats' | 'Settings' | 'Premium' | 'HowToPlay' | 'Debug';
    }
  | {
      readonly name: 'Game';
      readonly params: {
        readonly start: 'new';
        readonly ref: { readonly kind: 'level'; readonly level: number };
      };
    };

const ROUTES = {
  home: 'Home',
  levels: 'Levels',
  daily: 'Daily',
  stats: 'Stats',
  settings: 'Settings',
  premium: 'Premium',
  'how-to-play': 'HowToPlay',
  debug: 'Debug',
} as const;

export function isGameExample(screen: DebugScreen | undefined): screen is DebugGameExample {
  return (
    screen === 'game-start' ||
    screen === 'game-middle' ||
    screen === 'result-win' ||
    screen === 'result-lose'
  );
}

/** The first level without a result, as Home's "Play - Level N" (the last level when all are won). */
export function nextLevelOf(doc: SaveDoc, levelCount: number): number {
  for (let level = 1; level <= levelCount; level += 1) {
    if (doc.progress.levels[String(level)] === undefined) return level;
  }
  return Math.max(1, levelCount);
}

/** screen=game starts a new run of the given level (the link's level=, else the next level). */
export function debugRouteFor(
  screen: Exclude<DebugScreen, DebugGameExample>,
  level: number,
): DebugRoute {
  if (screen === 'game')
    return { name: 'Game', params: { start: 'new', ref: { kind: 'level', level } } };
  return { name: ROUTES[screen] };
}
