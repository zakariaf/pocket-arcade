// packages/shell/src/app/debug-link-handler.ts
// Test builds only, created through the test-only entry (TEST_ONLY.createDebugLinkHandler), so a
// store bundle never contains it. It applies <scheme>://debug/setup?... in a fixed order: the
// debug services (date, offline, premium, board layout, ads, seed: each kept in the test-only
// key-value store), then one save write (settings, first run, level and star fixtures), then either
// a direction reload (lang= flips the layout) or the requested screen. Before a reload it keeps the
// screen in the same store; start() opens it once the reloaded navigator is ready, so a flow that
// waits for the screen never notices the reload. S15's tools send typed requests through apply().
// Timing: createDebugParts calls listen(Linking) at once, so a link that arrives while the app is
// still starting (launchApp clearState, then openLink) is queued, never lost; start() (the
// navigator's onReady) applies the queue. A save write that switches the navigator's group (a
// first-run save and firstRun=0) opens screen= on the next navigation state, once the new group
// is mounted.
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { parseDebugLink } from '@e07/shell/screens/debug/debug-link.ts';
import { decodeSaveText } from '@e07/shell/screens/debug/debug-save-import.ts';
import { debugSaveRecipe, hasSaveChanges } from '@e07/shell/screens/debug/debug-save-recipe.ts';

import { createLinkIntake } from './debug-link-intake.ts';
import { debugRouteFor, isGameExample, nextLevelOf } from './debug-link-routes.ts';

import type { LinkSource } from './debug-link-intake.ts';
import type { DebugGameControls, DebugRoute } from './debug-link-routes.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { Direction } from '@e07/shell/i18n/languages.ts';
import type { DebugLinkRequest, DebugScreen } from '@e07/shell/screens/debug/debug-link.ts';
import type { DebugStore } from '@e07/shell/screens/debug/debug-overrides.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SectionWrite } from '@e07/shell/stores/update-and-publish.ts';

export type { LinkSource } from './debug-link-intake.ts';

export type DebugLinkDeps = {
  readonly services: DebugServices;
  /** The test-only key-value store (the same one the debug services keep their flags in). */
  readonly store: DebugStore;
  readonly readSave: () => SaveDoc;
  /** One validated write, then every section store re-reads (updateAndPublish). */
  readonly writeSave: (write: SectionWrite) => void;
  /** ClockPort.today of the app's one (simulated) clock. */
  readonly today: () => DateKey;
  readonly levelCount: number;
  /** readLayoutDirection() of this JS run, and the reload (restartForDirection after audio). */
  readonly layoutDirection: Direction;
  readonly restart: (direction: Direction) => Promise<void>;
  /** navigationRef.navigate for the route (the navigator must be ready). */
  readonly openRoute: (route: DebugRoute) => void;
  /** Calls back once, on the navigator's next state change (the group switch a write started). */
  readonly onNextNavigationState: (callback: () => void) => void;
  /** GameHost.debugControls(): action= and the example screens. */
  readonly game: DebugGameControls | null;
  /** ErrorLogPort.record('boot', ...): a bad link is logged and S15 shows it. */
  readonly onError: (error: unknown) => void;
};

export type DebugLinkOutcome =
  | { readonly kind: 'ignored' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'applied' }
  | { readonly kind: 'restarting'; readonly direction: Direction };

export type DebugImportResult =
  { readonly kind: 'imported' } | { readonly kind: 'error'; readonly message: string };

export type DebugLinkHandler = {
  /** Applies one link now (the intake calls it once the navigator is ready). */
  readonly handleUrl: (url: string) => DebugLinkOutcome;
  /** S15's tools: a typed request through the same steps as a link (debug-actions.ts). */
  readonly apply: (request: DebugLinkRequest) => DebugLinkOutcome;
  /**
   * S15's "Import save from text": the exported JSON through the save codec and schema, then one
   * validated write (the backup slot refreshed too). A failure changes nothing and is logged.
   */
  readonly importSave: (text: string) => DebugImportResult;
  /** createDebugParts, at once: the launch link and every later link, queued until start(). */
  readonly listen: (links: LinkSource) => () => void;
  /**
   * The navigator's onReady: the screen a reload was for, then every queued link in order (and
   * listening, unless listen() already does). The returned stop queues links again.
   */
  readonly start: (links: LinkSource) => () => void;
};

type Pending = { readonly screen: DebugScreen | null; readonly url: string };

const PENDING_KEY = 'debug.pending-screen';
/** The source of S15's requests (never a launch URL, so a reload never applies it twice). */
const S15 = 'debug menu';

/** The navigator's Main group is mounted once the tutorial is done (route-guards.ts). */
const isMainGroup = (doc: SaveDoc): boolean => doc.firstRun.tutorialDone;

/** firstRun=0 on a first-run save, or firstRun=1 on a finished one: the navigator changes group. */
const isGroupSwitch = (request: DebugLinkRequest, doc: SaveDoc): boolean =>
  request.firstRun !== undefined && request.firstRun === isMainGroup(doc);

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

/** Links whose parts cannot happen in one go: each needs a second link. */
function orderProblem(deps: DebugLinkDeps, request: DebugLinkRequest): string | null {
  const isFlip = request.lang !== undefined && directionOf(request.lang) !== deps.layoutDirection;
  if (isFlip && request.action !== undefined)
    return 'action= cannot follow a direction reload: send it in a second link';
  if (request.action !== undefined && isGroupSwitch(request, deps.readSave()))
    return 'action= cannot follow a first-run change: send it in a second link';
  const isMainScreen = request.screen !== undefined && request.screen !== 'debug';
  return request.firstRun === true && isMainScreen
    ? `screen=${request.screen} is not in the first-run screens that firstRun=1 opens`
    : null;
}

/** Why the request cannot be applied in this build, or null. */
function refusal(deps: DebugLinkDeps, request: DebugLinkRequest): string | null {
  const badLevel = levelProblem(deps, request);
  if (badLevel !== null) return badLevel;
  const isGameNeeded = request.action !== undefined || isGameExample(request.screen);
  if (isGameNeeded && deps.game === null) {
    return 'action= and the game example screens need the game host debug controls';
  }
  return orderProblem(deps, request);
}

function openScreen(deps: DebugLinkDeps, screen: DebugScreen, level?: number): void {
  if (isGameExample(screen)) {
    deps.game?.openExample(screen);
    return;
  }
  deps.openRoute(debugRouteFor(screen, level ?? nextLevelOf(deps.readSave(), deps.levelCount)));
}

/** A bad link is never ignored: it is logged, and S15 (whose Error log row counts it) opens. */
function reject(deps: DebugLinkDeps, source: string, message: string): DebugLinkOutcome {
  deps.onError(new Error(`${source}: ${message}`));
  deps.openRoute({ name: 'Debug' });
  return { kind: 'error', message };
}

type Step = { readonly source: string; readonly url: string; readonly isSwitch: boolean };

/** screen=: at once, or, after a write that switches the navigator's group, once it is there. */
function openRequested(deps: DebugLinkDeps, request: DebugLinkRequest, isSwitch: boolean): void {
  const { screen, level } = request;
  if (screen === undefined) return;
  if (!isSwitch) {
    openScreen(deps, screen, level);
    return;
  }
  deps.onNextNavigationState(() => {
    openScreen(deps, screen, level);
  });
}

/** action=: the game host ends the level on screen; without one the link is an error. */
function playAction(deps: DebugLinkDeps, action: 'win-level' | 'lose-level', source: string) {
  const hasEnded = deps.game?.playTo(action === 'win-level' ? 'won' : 'lost') === true;
  if (hasEnded) return { kind: 'applied' } as const;
  return reject(deps, source, `action=${action} needs a level on screen: open it first`);
}

function finish(deps: DebugLinkDeps, request: DebugLinkRequest, step: Step): DebugLinkOutcome {
  if (request.lang !== undefined && directionOf(request.lang) !== deps.layoutDirection) {
    const direction = directionOf(request.lang);
    const pending: Pending = { screen: request.screen ?? null, url: step.url };
    deps.store.set(PENDING_KEY, JSON.stringify(pending));
    deps.restart(direction).catch(deps.onError);
    return { kind: 'restarting', direction };
  }
  openRequested(deps, request, step.isSwitch);
  return request.action === undefined
    ? { kind: 'applied' }
    : playAction(deps, request.action, step.source);
}

/** Services first, then one save write, then the reload or the screen. url names the source. */
function applyRequest(
  deps: DebugLinkDeps,
  request: DebugLinkRequest,
  url: string,
): DebugLinkOutcome {
  const source = url === S15 ? S15 : `debug link ${url}`;
  const refused = refusal(deps, request);
  if (refused !== null) return reject(deps, source, refused);
  const isSwitch = isGroupSwitch(request, deps.readSave());
  applyServices(deps.services, request);
  if (hasSaveChanges(request)) {
    deps.writeSave({ recipe: debugSaveRecipe(request, deps.today()), refreshBackup: false });
  }
  return finish(deps, request, { source, url, isSwitch });
}

function handle(deps: DebugLinkDeps, url: string): DebugLinkOutcome {
  const parsed = parseDebugLink(url);
  if (parsed.kind === 'not-debug') return { kind: 'ignored' };
  if (parsed.kind === 'error') return reject(deps, `debug link ${url}`, parsed.message);
  return applyRequest(deps, parsed.request, url);
}

function importSave(deps: DebugLinkDeps, text: string): DebugImportResult {
  const decoded = decodeSaveText(text, deps.readSave().gameId);
  if (decoded.kind === 'error') {
    deps.onError(new Error(`${S15}: import save: ${decoded.message}`));
    return decoded;
  }
  deps.writeSave({ recipe: () => decoded.doc, refreshBackup: true });
  return { kind: 'imported' };
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
  const intake = createLinkIntake({ onUrl: handleUrl, onError: deps.onError });
  return {
    handleUrl,
    apply: (request) => applyRequest(deps, request, S15),
    importSave: (text) => importSave(deps, text),
    listen: intake.listen,
    start: (links) => {
      const pending = takePending(deps.store);
      // A cold start by the link that asked for the reload is that same link: never twice.
      return intake.start(links, {
        skipLaunchUrl: pending?.url ?? null,
        onReady: () => {
          if (pending !== null && pending.screen !== null) openScreen(deps, pending.screen);
        },
      });
    },
  };
}
