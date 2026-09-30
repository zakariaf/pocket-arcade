// packages/shell/src/game-host/game-host.ts
import { createElement } from 'react';

import { createFullscreenGate } from '@e07/shell/game-host/fullscreen-gate.ts';
import {
  EXAMPLE_RUN,
  createGameDebugControls,
  endStateOf,
} from '@e07/shell/game-host/game-debug-controls.ts';
import { hasMusicOf, isScoreRatedOf } from '@e07/shell/game-host/game-facts.ts';
import {
  entryFor,
  newSession,
  resumeSession,
  sessionRulesFor,
} from '@e07/shell/game-host/open-session.ts';
import { createRunTracker } from '@e07/shell/game-host/run-tracker.ts';
import { toSavedRun } from '@e07/shell/game-host/saved-run.ts';
import { createSessionController } from '@e07/shell/game-host/session-controller.ts';
import {
  coachStepsOf,
  howToPlayPagesOf,
  isTutorialMoveAccepted,
} from '@e07/shell/game-host/tutorial-script.ts';

import type { LevelPack } from '@e07/game-kit/contract/levels.ts';
import type { MessageId } from '@e07/game-kit/contract/messages.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { CreditEntry } from '@e07/shell/art/credit-entry.ts';
import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { FullscreenGate } from '@e07/shell/game-host/fullscreen-gate.ts';
import type { GameDebugControls } from '@e07/shell/game-host/game-debug-controls.ts';
import type { GameSession, SessionStatus } from '@e07/shell/game-host/game-session-types.ts';
import type { SessionOpen } from '@e07/shell/game-host/open-session.ts';
import type { RunSummary } from '@e07/shell/game-host/run-summary.ts';
import type { RunTracker } from '@e07/shell/game-host/run-tracker.ts';
import type { SessionController } from '@e07/shell/game-host/session-controller.ts';
import type { SessionHandle } from '@e07/shell/game-host/session-view.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { HowToPlayPage, TutorialCoachStep } from '@e07/shell/game-host/tutorial-script.ts';
import type { GameParams } from '@e07/shell/navigation/route-params.ts';
import type { FeedbackPorts } from '@e07/shell/services/audio/ui-feedback.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SectionWrite } from '@e07/shell/stores/update-and-publish.ts';
import type { ComponentType, ReactNode } from 'react';

export type BoardHostProps = {
  readonly testID: string;
  /** The Tutorial screen's pointer cells, outlined on the board with the hinted ones. */
  readonly coachTargets?: readonly BoardTarget[];
};

type Controller<T extends ShellGameTypes> = SessionController<T['state'], T['move'], T['event']>;

/** What the board layer gets to draw and drive one session (typed inside the seam only). */
export type BoardHostInput<T extends ShellGameTypes> = {
  readonly game: ShellGameModule<T>;
  readonly controller: Controller<T>;
  /** Stop the board while a full-screen ad covers the app (useIsFullscreenAdShowing). */
  readonly lifecycle: FullscreenGate;
};

/** Implemented by the board layer (GameBoardHost); injected so this file needs no Skia. */
export type BoardHostFactory = <T extends ShellGameTypes>(
  input: BoardHostInput<T>,
) => ComponentType<BoardHostProps>;

/** One S13 picture: the game's how-to-play page drawn by its own board (a static Skia canvas). */
export type ExamplePictureProps = { readonly pageIndex: number };

/** Implemented by the board layer (createExamplePicture); injected so this file needs no Skia. */
export type ExamplePictureFactory = <T extends ShellGameTypes>(
  game: ShellGameModule<T>,
) => ComponentType<ExamplePictureProps>;

export type GameHostDeps = {
  readonly save: SaveService;
  readonly clock: ClockPort;
  readonly errorLog: ErrorLogPort;
  /** game.config isContinueAllowed, read from expo.extra (readGameExtra). */
  readonly isContinueAllowed: boolean;
  readonly createBoardHost: BoardHostFactory;
  /** The S13 pictures (createExamplePicture()); without it the pages show no picture. */
  readonly createExamplePicture?: ExamplePictureFactory;
  /** The audio and haptics ports: a decided result plays ui.win + success or ui.lose + error. */
  readonly feedback: FeedbackPorts;
  /** More sections for the one run-end update (the ads skill records its history here). */
  readonly extendRunEnd?: (doc: SaveDoc, summary: RunSummary) => SaveDoc;
  /**
   * Test builds: the debug link's seed= (e2e-maestro's debug services, seedOverride()). An endless
   * run starts from it instead of the clock, so a flow replays the same run; null means the clock.
   */
  readonly seedOverride?: () => number | null;
  /**
   * Test builds: opens the Game route (the debug navigator's push), so the debug controls'
   * openExample can show an example run; unit tests leave it out.
   */
  readonly openGame?: (params: GameParams) => void;
  /**
   * The run-end write (spec S7): the composition root passes
   * (write) => updateAndPublish(save, stores, write), so the save is written once with the backup
   * refreshed and the progress and stats stores re-read it before the result screen shows.
   */
  readonly writeRunEnd: (write: SectionWrite) => void;
};

/** One S10 statistics card: the counter's save key and the game's catalog key for its label. */
export type HostCounter = { readonly id: string; readonly labelId: MessageId };

/** One opened run: the type-erased handle for screens and its bound board. */
export type OpenedSession = {
  readonly handle: SessionHandle;
  readonly BoardHost: ComponentType<BoardHostProps>;
};

/**
 * The Shell's type-erased handle on the game. createGameHost<T> is the ONLY generic seam:
 * everything that touches the game's state, move and event types lives in its closure, so
 * screens, stores and navigation never see them and no cast is needed.
 */
export type GameHost = {
  readonly id: string;
  /** Catalog key of the game's name ('<id>.name'): S1, S4 and S11b through gameMessageText. */
  readonly nameId: string;
  /** Catalog key of the S7 win title ('<id>.win-title'): resultModelOf reads it. */
  readonly winTitleId: string;
  /** Catalog key of the tagline ('<id>.tagline'): S1, S4 and S11b through gameMessageText. */
  readonly taglineId: string;
  /** The game's LOGO_ART for LogoTile: S1, S4, the S7 lose picture, S10 and S11b. */
  readonly logo: LogoArt;
  /** The game's own S11d rows: the licences screen appends creditRowsOf(host.credits). */
  readonly credits: readonly CreditEntry[];
  /** The game's statistics counters (S10 cards, Home): save key and label key, in game order. */
  readonly counters: readonly HostCounter[];
  /** counters.map((counter) => counter.id): the keys in the save's stats.counters. */
  readonly counterIds: readonly string[];
  /** hasMusicOf(game): a 'music' sound in the bank; S6 and S11 show the Music rows only then. */
  readonly hasMusic: boolean;
  /** isScoreRatedOf(game): levels rated by score; the S7 win prints the score line, no par. */
  readonly isScoreRated: boolean;
  /** The tutorial level's coach steps (S13): one sentence and one pointer each, no game types. */
  readonly tutorialSteps: readonly TutorialCoachStep[];
  /** The game's level packs (S8): name key, first level, level count, stars to unlock. */
  readonly packs: readonly LevelPack[];
  /** The S13 how-to-play pages: goal and step sentence as catalog keys (3 to 5 pages). */
  readonly howToPlayPages: readonly HowToPlayPage[];
  /** S13: the page's example state drawn by the game's own board; null without a picture factory. */
  readonly renderHowToPlayPicture: (pageIndex: number) => ReactNode;
  readonly hasSavedRun: () => boolean;
  /** null when there is no such run: no saved run, an unknown level, a mode the game lacks. */
  readonly openSession: (open: SessionOpen) => OpenedSession | null;
  /** The ads layer suspends the game through it: runFullscreenAd(host.lifecycle, show). */
  readonly lifecycle: FullscreenGate;
  /**
   * Test builds only, through createDebugParts (store builds get null debug parts): the E2E debug
   * link's playTo and openExample, and the parity frames' fixture numbers.
   */
  readonly debugControls: () => GameDebugControls;
};

type Session<T extends ShellGameTypes> = GameSession<T['state'], T['move'], T['event']>;

const UINT32_RANGE = 4_294_967_296;

/** Endless runs get a fresh uint32 seed from the clock (or the test build's debug seed). */
function clockSeed(clock: ClockPort, override?: () => number | null): () => number {
  return () => override?.() ?? Math.floor(clock.nowMs()) % UINT32_RANGE;
}

/** A new run is written at once (so Home can offer Continue); a resumed run is validated. */
function firstSession<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  deps: GameHostDeps,
  open: SessionOpen,
): Session<T> | null {
  if (open.start === 'new') {
    const session = newSession(game, open.ref, clockSeed(deps.clock, deps.seedOverride));
    if (session !== null) {
      const run = toSavedRun(session, game.persistence.stateVersion, true);
      deps.save.update((doc) => ({ ...doc, run }));
    }
    return session;
  }
  const saved = deps.save.doc().run;
  const session = saved === null ? null : resumeSession(game, saved, deps.errorLog);
  if (saved !== null && session === null) deps.save.update((doc) => ({ ...doc, run: null }));
  return session;
}

/** A new level-1 run standing at a staged example state (the debug controls' openExample). */
function exampleSession<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  deps: GameHostDeps,
  state: T['state'],
): Session<T> | null {
  const fresh = firstSession(game, deps, EXAMPLE_RUN);
  if (fresh === null) return null;
  const outcome = game.engine.outcome(state);
  const status: SessionStatus = outcome.kind === 'playing' ? 'playing' : outcome.kind;
  const session = { ...fresh, state, outcome, status };
  const run = toSavedRun(session, game.persistence.stateVersion, true);
  deps.save.update((doc) => ({ ...doc, run }));
  return session;
}

/** The tutorial run plays its script: each step accepts only its expected move. */
function tutorialFilter<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
): (move: T['move'], moveCount: number) => boolean {
  const { steps } = game.teaching.tutorial;
  return (move, moveCount) => isTutorialMoveAccepted(steps, move, moveCount);
}

function controllerFor<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  deps: GameHostDeps,
  session: Session<T>,
): Controller<T> {
  const controllerDeps = {
    rules: sessionRulesFor(game, session.ref),
    hud: game.rules.hud,
    counters: game.stats.counters,
    entry: entryFor(game, session.ref),
    table: game.levels.table,
    engine: game.engine,
    gameRules: game.rules,
    persistence: game.persistence,
    save: deps.save,
    today: deps.clock.today,
    nowMs: deps.clock.nowMs,
    isContinueAllowed: deps.isContinueAllowed,
    writeRunEnd: deps.writeRunEnd,
    feedback: deps.feedback,
    ...(deps.extendRunEnd === undefined ? {} : { extendRunEnd: deps.extendRunEnd }),
    ...(session.ref.kind === 'tutorial' ? { isMoveAccepted: tutorialFilter(game) } : {}),
  };
  return createSessionController(controllerDeps, session);
}

type TeachingFacts = Pick<GameHost, 'tutorialSteps' | 'howToPlayPages' | 'renderHowToPlayPicture'>;

/** The tutorial coach, the S13 pages and their pictures, as plain data and one render function. */
function teachingOf<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  deps: GameHostDeps,
): TeachingFacts {
  // Built once per app: the picture component closes over the typed module (the seam).
  const picture = deps.createExamplePicture?.(game) ?? null;
  return {
    tutorialSteps: coachStepsOf(game.teaching.tutorial.steps),
    howToPlayPages: howToPlayPagesOf(game.teaching.howToPlay),
    renderHowToPlayPicture: (pageIndex) =>
      picture === null ? null : createElement(picture, { pageIndex }),
  };
}

type GameFacts = Omit<
  GameHost,
  keyof TeachingFacts | 'hasSavedRun' | 'openSession' | 'lifecycle' | 'debugControls'
>;

/** What screens read about the game: names, art, counters, music and packs. */
function factsOf<T extends ShellGameTypes>(game: ShellGameModule<T>): GameFacts {
  const counters = game.stats.counters.map(({ id, labelId }) => ({ id, labelId }));
  return {
    id: game.identity.id,
    nameId: game.identity.nameId,
    winTitleId: game.identity.winTitleId,
    taglineId: game.identity.taglineId,
    logo: game.presentation.art.logo,
    credits: game.presentation.art.credits,
    counters,
    counterIds: counters.map((counter) => counter.id),
    hasMusic: hasMusicOf(game),
    isScoreRated: isScoreRatedOf(game),
    packs: game.levels.packs,
  };
}

type Opener<T extends ShellGameTypes> = {
  readonly game: ShellGameModule<T>;
  readonly deps: GameHostDeps;
  readonly lifecycle: FullscreenGate;
  readonly runs: RunTracker<T>;
};

/** Opens a run (or the staged example), binds its board and tracks it for the debug controls. */
function openRun<T extends ShellGameTypes>(
  opener: Opener<T>,
  open: SessionOpen,
): OpenedSession | null {
  const { game, deps, lifecycle, runs } = opener;
  const example = runs.take(open);
  const session =
    example === null ? firstSession(game, deps, open) : exampleSession(game, deps, example.state);
  if (session === null) return null;
  const controller = controllerFor(game, deps, session);
  const handle = runs.track(controller);
  // openExample('result-win' | 'result-lose'): the example run ends at once, like playTo.
  if (example !== null && example.endsAs !== null) {
    controller.endWith(endStateOf(game, example.endsAs));
  }
  return { handle, BoardHost: deps.createBoardHost({ game, controller, lifecycle }) };
}

export function createGameHost<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  deps: GameHostDeps,
): GameHost {
  const saved = deps.save.doc().run;
  // At boot: validate the saved run with the game's own parsers; drop only the run if invalid.
  if (saved !== null && resumeSession(game, saved, deps.errorLog) === null) {
    deps.save.update((doc) => ({ ...doc, run: null }));
  }
  const lifecycle = createFullscreenGate();
  const runs = createRunTracker<T>();
  const openGame = deps.openGame;
  const controls = createGameDebugControls({ game, runs, ...(openGame ? { openGame } : {}) });
  return {
    ...factsOf(game),
    ...teachingOf(game, deps),
    hasSavedRun: () => deps.save.doc().run !== null,
    openSession: (open) => openRun({ game, deps, lifecycle, runs }, open),
    lifecycle,
    debugControls: () => controls,
  };
}
