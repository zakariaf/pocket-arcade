// packages/shell/src/app/debug-link-handler.ts
// Test builds only, created through the test-only entry (TEST_ONLY.createDebugLinkHandler), so a
// store bundle never contains it. It applies <scheme>://debug/setup?... in a fixed order: the
// debug services (date, offline, premium, board layout, ads, seed: each kept in the test-only
// key-value store), then one save write (settings, first run, level and star fixtures), then either
// a direction reload (lang= flips the layout) or the requested screen. Before a reload it keeps the
// screen in the same store; start() opens it once the reloaded navigator is ready, so a flow that
// waits for the screen never notices the reload. S15's tools send typed requests through apply().
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { parseDebugLink } from '@e07/shell/screens/debug/debug-link.ts';
import { debugSaveRecipe, hasSaveChanges } from '@e07/shell/screens/debug/debug-save-recipe.ts';

import { debugRouteFor, isGameExample, nextLevelOf } from './debug-link-routes.ts';

import type { DebugGameControls, DebugRoute } from './debug-link-routes.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { Direction } from '@e07/shell/i18n/languages.ts';
import type { DebugLinkRequest, DebugScreen } from '@e07/shell/screens/debug/debug-link.ts';
import type { DebugStore } from '@e07/shell/screens/debug/debug-overrides.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type DebugLinkDeps = {
  readonly services: DebugServices;
  /** The test-only key-value store (the same one the debug services keep their flags in). */
  readonly store: DebugStore;
  readonly readSave: () => SaveDoc;
  /** One validated write, then every section store re-reads (updateAndPublish). */
  readonly writeSave: (recipe: (doc: SaveDoc) => SaveDoc) => void;
  /** ClockPort.today of the app's one (simulated) clock. */
  readonly today: () => DateKey;
  readonly levelCount: number;
  /** readLayoutDirection() of this JS run, and the reload (restartForDirection after audio). */
  readonly layoutDirection: Direction;
  readonly restart: (direction: Direction) => Promise<void>;
  /** navigationRef.navigate for the route (the navigator must be ready). */
  readonly openRoute: (route: DebugRoute) => void;
  /** The game host's debug entry points; null until the host ships them. */
  readonly game: DebugGameControls | null;
  /** ErrorLogPort.record('boot', ...): a bad link is logged and S15 shows it. */
  readonly onError: (error: unknown) => void;
};

export type DebugLinkOutcome =
  | { readonly kind: 'ignored' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'applied' }
  | { readonly kind: 'restarting'; readonly direction: Direction };

/** What React Native's Linking offers (a fake in tests). */
export type LinkSource = {
  readonly getInitialURL: () => Promise<string | null | undefined>;
  readonly addEventListener: (
    type: 'url',
    listener: (event: { readonly url: string }) => void,
  ) => { readonly remove: () => void };
};

export type DebugLinkHandler = {
  readonly handleUrl: (url: string) => DebugLinkOutcome;
  /** S15's tools: a typed request through the same steps as a link (debug-actions.ts). */
  readonly apply: (request: DebugLinkRequest) => DebugLinkOutcome;
  /** Once the navigator is ready: the screen a reload was for, the launch link, then every link. */
  readonly start: (links: LinkSource) => () => void;
};

type Pending = { readonly screen: DebugScreen | null; readonly url: string };

const PENDING_KEY = 'debug.pending-screen';
/** The source of S15's requests (never a launch URL, so a reload never applies it twice). */
const S15 = 'debug menu';

function applyServices(services: DebugServices, request: DebugLinkRequest): void {
  if (request.date !== undefined) services.setDate(request.date);
  if (request.offline !== undefined) services.setOffline(request.offline);
  if (request.premium !== undefined) services.setPremium(request.premium);
  if (request.boardLayout !== undefined) services.setBoardLayout(request.boardLayout);
  if (request.ads !== undefined)
    services.setAdsOverride(request.ads === 'off' ? 'never' : 'always-test');
  if (request.seed !== undefined) services.setSeed(request.seed);
}

/** A level the game does not ship (the parser only knows 1..9999). */
function levelProblem(deps: DebugLinkDeps, request: DebugLinkRequest): string | null {
  const stars = typeof request.stars === 'object' ? request.stars : [];
  const levels = [request.level ?? 1, ...stars.map((entry) => entry.level)];
  const past = levels.find((level) => level > deps.levelCount);
  if (past === undefined) return null;
  return `level ${String(past)} is past the last level (${String(deps.levelCount)})`;
}

/** Why the request cannot be applied in this build, or null. */
function refusal(deps: DebugLinkDeps, request: DebugLinkRequest): string | null {
  const badLevel = levelProblem(deps, request);
  if (badLevel !== null) return badLevel;
  const isGameNeeded = request.action !== undefined || isGameExample(request.screen);
  if (isGameNeeded && deps.game === null) {
    return 'action= and the game example screens need the game host debug controls';
  }
  const isFlip = request.lang !== undefined && directionOf(request.lang) !== deps.layoutDirection;
  return isFlip && request.action !== undefined
    ? 'action= cannot follow a direction reload: send it in a second link'
    : null;
}

function openScreen(deps: DebugLinkDeps, screen: DebugScreen, level?: number): void {
  if (isGameExample(screen)) {
    deps.game?.openExample(screen);
    return;
  }
  deps.openRoute(debugRouteFor(screen, level ?? nextLevelOf(deps.readSave(), deps.levelCount)));
}

function finish(deps: DebugLinkDeps, request: DebugLinkRequest, url: string): DebugLinkOutcome {
  if (request.lang !== undefined && directionOf(request.lang) !== deps.layoutDirection) {
    const direction = directionOf(request.lang);
    const pending: Pending = { screen: request.screen ?? null, url };
    deps.restart(direction).catch(deps.onError);
    deps.store.set(PENDING_KEY, JSON.stringify(pending));
    return { kind: 'restarting', direction };
  }
  if (request.screen !== undefined) openScreen(deps, request.screen, request.level);
  if (request.action !== undefined)
    deps.game?.playTo(request.action === 'win-level' ? 'won' : 'lost');
  return { kind: 'applied' };
}

/** A bad link is never ignored: it is logged, and S15 (whose Error log row counts it) opens. */
function reject(deps: DebugLinkDeps, source: string, message: string): DebugLinkOutcome {
  deps.onError(new Error(`${source}: ${message}`));
  deps.openRoute({ name: 'Debug' });
  return { kind: 'error', message };
}

/** Services first, then one save write, then the reload or the screen. url names the source. */
function applyRequest(
  deps: DebugLinkDeps,
  request: DebugLinkRequest,
  url: string,
): DebugLinkOutcome {
  const refused = refusal(deps, request);
  if (refused !== null) return reject(deps, url === S15 ? S15 : `debug link ${url}`, refused);
  applyServices(deps.services, request);
  if (hasSaveChanges(request)) deps.writeSave(debugSaveRecipe(request, deps.today()));
  return finish(deps, request, url);
}

function handle(deps: DebugLinkDeps, url: string): DebugLinkOutcome {
  const parsed = parseDebugLink(url);
  if (parsed.kind === 'not-debug') return { kind: 'ignored' };
  if (parsed.kind === 'error') return reject(deps, `debug link ${url}`, parsed.message);
  return applyRequest(deps, parsed.request, url);
}

/** The screen (and link) a direction reload was for, read once. */
function takePending(store: DebugStore): Pending | null {
  const raw = store.get(PENDING_KEY);
  if (raw === null) return null;
  store.set(PENDING_KEY, null);
  try {
    return JSON.parse(raw) as Pending;
  } catch {
    return null;
  }
}

export function createDebugLinkHandler(deps: DebugLinkDeps): DebugLinkHandler {
  const handleUrl = (url: string): DebugLinkOutcome => handle(deps, url);
  return {
    handleUrl,
    apply: (request) => applyRequest(deps, request, S15),
    start: (links) => {
      const pending = takePending(deps.store);
      if (pending !== null && pending.screen !== null) openScreen(deps, pending.screen);
      links
        .getInitialURL()
        .then((url) => {
          // A cold start by the link that asked for the reload is that same link: never twice.
          if (typeof url === 'string' && url !== pending?.url) handleUrl(url);
        })
        .catch(deps.onError);
      const subscription = links.addEventListener('url', (event) => {
        handleUrl(event.url);
      });
      return () => {
        subscription.remove();
      };
    },
  };
}
