// packages/shell/src/app/debug-link-routes.ts
// Where a debug link's screen= goes, and how it opens: on a fixed stack, the navigator's first route
// alone or with the route on top (navigate pushes in React Navigation 7, so links would otherwise
// stack on the screens of earlier links). Only S15 for a rejected link opens on top of the screen
// the link came from instead (DebugRoutePlacement). Routes are the navigator's own names; the four
// game example states belong to the game host, which knows how to build them. A reset leaves the
// open Game screen's live run first (the test build's live-run exit, DebugParts.liveRunExit), as
// Pause -> Home does: the Game screen guards every other reset like Back.
import type { LiveRunExit } from '@e07/shell/game-host/live-run-exit.ts';
import type { DebugScreen } from '@e07/shell/screens/debug/debug-link.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { NavigationContainerRef, ParamListBase } from '@react-navigation/native';

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

/** The navigator ref calls a debug link needs (the container ref from createDebugParts). */
export type DebugNavigation = Pick<
  NavigationContainerRef<ParamListBase>,
  'isReady' | 'getRootState' | 'reset' | 'navigate'
>;

/**
 * Resets the stack to its first route alone (Home, or the first-run screen), keeping that route's
 * key so it stays mounted; null while the navigator is not ready. Every debug screen then opens on
 * a fixed stack: never above the screens earlier links opened. A live run on the Game screen is
 * left first through `exit` (the test build's live-run exit), as Pause -> Home leaves it, so the
 * Game screen lets the reset through.
 */
export function resetToFirstRoute(
  navigation: DebugNavigation,
  exit: Pick<LiveRunExit, 'leave'> | null,
): string | null {
  if (!navigation.isReady()) return null;
  const first = navigation.getRootState()?.routes[0];
  if (first === undefined) return null;
  exit?.leave();
  // Key and name only: the first routes (Home, LanguageChoice) take no params.
  navigation.reset({ index: 0, routes: [{ key: first.key, name: first.name }] });
  return first.name;
}

/**
 * Where a debug route opens: a screen= link (S15's tools included, and the game examples through
 * the debug controls) on a fixed stack; S15 for a rejected link on top of the screen the link came
 * from, so that screen is still there behind it.
 */
export type DebugRoutePlacement = 'fixed-stack' | 'on-top';

export type OpenDebugRoute = (
  navigation: DebugNavigation,
  route: DebugRoute,
  placement?: DebugRoutePlacement,
) => void;

/**
 * Opens debug routes, leaving a live run through `exit` before each fixed-stack reset (the test
 * build's live-run exit: createDebugParts binds DebugParts.liveRunExit). fixed-stack: [first
 * route] for the first route itself, else [first route, route]. on-top: the route above whatever
 * is open (navigate pushes in React Navigation 7).
 */
export function debugRouteOpener(exit: Pick<LiveRunExit, 'leave'> | null): OpenDebugRoute {
  return (navigation, route, placement = 'fixed-stack') => {
    if (placement === 'fixed-stack' && resetToFirstRoute(navigation, exit) === route.name) return;
    if (route.name === 'Game') navigation.navigate(route.name, route.params);
    else navigation.navigate(route.name);
  };
}

/** The opener with no live run to leave (a navigator without a Game screen open). */
export const openDebugRoute: OpenDebugRoute = debugRouteOpener(null);
