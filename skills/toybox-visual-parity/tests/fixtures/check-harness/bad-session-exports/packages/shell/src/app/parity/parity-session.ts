// packages/shell/src/app/parity/parity-session.ts
// Test builds only (reached through test-only.ts). The parity request of this launch, for the model
// hooks and hosts that read it after startup: the build number in the version text, the frame state
// a screen opens on (a dialog, a result, a tapped tile), the frozen-motion switch, the board probe
// and the design's numbers for the Game frames. A normal launch never starts a session.
import { PARITY_FIXTURE } from './parity-fixture.ts';

import type { ParityFixture } from './parity-fixture.ts';
import type { ParityState } from './parity-plans.ts';
import type { ParityRequest } from './parity-request.ts';

/** The design's numbers a Game frame (S5, S6, S7) draws, for the design game of this launch. */
export type ParityGameFixture = {
  /** The design game (lineSiege, flockTilt, scrapShove). */
  readonly designGame: string;
  readonly level: number;
  readonly score: number;
  /** The level's best score after this run (the win is a new best, so it equals score). */
  readonly bestScore: number;
  readonly isNewBest: boolean;
  readonly stars: number;
  readonly movesCount: number;
  /** A moves-rated game shows "7 moves – par 7"; a score-rated one shows the score line. */
  readonly par: number;
  /** The game's progress message params: mid in the top bar (S5, S6), full on the win card (S7). */
  readonly progressMid: Readonly<Record<string, number>>;
  readonly progressFull: Readonly<Record<string, number>>;
  /** The game's first lose-reason key ('line-siege.lose.broke-through'). */
  readonly loseReasonId: string;
  /** The lose frame offers Continue with an ad (the parity ads port has one ready). */
  readonly isContinueOffered: boolean;
  /** What the frame shows: a won or a lost level (the Result frames), or null (the paused game). */
  readonly outcome: 'won' | 'lost' | null;
};

let active: ParityRequest | null = null;

/** Called once by the Shell's startup with a valid request (readParityLaunch). */
export function startParitySession(request: ParityRequest): void {
  active = request;
}

/** Tests only: back to a normal launch. */
export function endParitySession(): void {
  active = null;
}

/** The fixture's build number ("1.0.0 (8)" in S11 and S11b); null on a normal launch. */
export function parityBuildNumber(): string | null {
  return active === null ? null : PARITY_FIXTURE.buildNumber;
}

/**
 * The state the frame's screen opens on (pause-open, levels-locked-tile-tapped ...); null on a
 * normal launch, in the board probe launch (it opens nothing) and for frames that draw the plain
 * screen. The screen's model hook applies it once, through the handler a player's tap would use.
 */
export function parityFrameState(): ParityState | null {
  if (active === null || active.probe === 'board') return null;
  return active.plan.state;
}

/**
 * The one frozen-motion switch: true for every parity launch (the capture always asks for
 * animations=off). app/use-reduce-motion.ts returns true while it is, so every decorative loop and
 * entrance that honours Reduce motion holds still (the current level's flag, the busy blocks,
 * sticker slaps, star pops, confetti, screen transitions). The saved setting is not touched.
 */
export function isParityMotionFrozen(): boolean {
  return active !== null;
}

/**
 * True in the probe=board launch that runs once before a Game-route frame's capture: the host's
 * isLayoutProbeOn closure returns true while it is, so the board host renders game.board-layout
 * (the canvas origin and BoardLayout in window points), and the capture script masks that rectangle.
 */
function isParityBoardProbeOn(): boolean {
  return active?.probe === 'board';
}

const OUTCOMES: Readonly<Record<string, ParityGameFixture['outcome']>> = {
  'result-win': 'won',
  'result-lose': 'lost',
};

function gameFixtureOf(request: ParityRequest, fixture: ParityFixture): ParityGameFixture | null {
  const frame = fixture.gameFrame;
  const game = frame.games[request.game];
  if (game === undefined) return null;
  return {
    designGame: request.game,
    level: frame.level,
    score: frame.score,
    bestScore: frame.bestScore,
    isNewBest: frame.isNewBest,
    stars: frame.stars,
    movesCount: frame.movesCount,
    par: frame.par,
    progressMid: game.progressMid,
    progressFull: game.progressFull,
    loseReasonId: game.loseReasonId,
    isContinueOffered: frame.isContinueOffered,
    outcome: OUTCOMES[request.plan.state ?? ''] ?? null,
  };
}

/**
 * The design's numbers for the Game frames (level 12, score 1,840, 3 stars, New best, 7 moves with
 * par 7, the game's progress at mid and full, its first lose reason, the Continue offer), from the
 * fixture's gameFrame block; null on a normal launch, for a frame that does not start on the Game
 * route and for a design game the fixture does not know. The Game screen's session controls pass it
 * to debugControls().applyFixtureHud (S5, S6) and showFixtureResult (S7), which write no save.
 */
export function parityGameFixture(
  fixture: ParityFixture = PARITY_FIXTURE,
): ParityGameFixture | null {
  if (active?.plan.start !== 'Game') return null;
  return gameFixtureOf(active, fixture);
}
