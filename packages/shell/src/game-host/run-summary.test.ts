// packages/shell/src/game-host/run-summary.test.ts
import { entryFor, newSession, sessionRulesFor } from '@e07/shell/game-host/open-session.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { gameSessionReducer } from './game-session-reducer.ts';
import { runEndOf, summarizeRun } from './run-summary.ts';

import type { GameSession } from './game-session-types.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';
import type { TallyEvent, TallyMove, TallyState } from '@e07/shell/testing/tally-game.ts';

type Tally = GameSession<TallyState, TallyMove, TallyEvent>;

function played(ref: RunRef, amounts: readonly (1 | 2)[]): Tally {
  const start = newSession(TALLY_GAME, ref, () => 7);
  if (start === null) throw new Error('no session');
  return amounts.reduce(
    (session, amount) =>
      gameSessionReducer(sessionRulesFor(TALLY_GAME, ref), session, {
        type: 'apply-move',
        move: { kind: 'add', amount },
      }),
    start,
  );
}

function contextFor(ref: RunRef) {
  return {
    rules: sessionRulesFor(TALLY_GAME, ref),
    hud: TALLY_GAME.rules.hud,
    counters: TALLY_GAME.stats.counters,
    entry: entryFor(TALLY_GAME, ref),
    table: TALLY_GAME.levels.table,
  };
}

const BEFORE = createDefaultSaveDoc('tally');
const LEVEL_1: RunRef = { kind: 'level', level: 1 };

describe('summarizeRun', () => {
  it('rates a won level against its par and points at the next level', () => {
    expect(summarizeRun(played(LEVEL_1, [2, 2]), contextFor(LEVEL_1), BEFORE)).toStrictEqual({
      ref: LEVEL_1,
      isWon: true,
      loseReasonKey: null,
      score: 40,
      moves: 2,
      playMs: 0,
      stars: 3,
      par: 2,
      isNewBest: true,
      levelBestScore: 40,
      nextLevel: 2,
    });
  });

  it('gives fewer stars above par and no next level after the last one', () => {
    const last: RunRef = { kind: 'level', level: 3 };
    const summary = summarizeRun(played(last, [1, 1, 1, 1, 1, 1]), contextFor(last), BEFORE);
    expect([summary.stars, summary.nextLevel]).toStrictEqual([1, null]);
  });

  it('keeps the lose reason and gives a loss no stars and no new best', () => {
    const summary = summarizeRun(played(LEVEL_1, [2, 1, 2]), contextFor(LEVEL_1), BEFORE);
    expect(summary).toMatchObject({
      isWon: false,
      loseReasonKey: 'tally.lose.overshot',
      stars: 0,
      isNewBest: false,
    });
  });

  it('compares with the best result already saved', () => {
    const best = {
      stars: 3,
      bestScore: 40,
      bestMoves: 2,
      completions: 1,
      firstCompletedOn: '2026-09-01',
    } as const;
    const before = { ...BEFORE, progress: { ...BEFORE.progress, levels: { '1': best } } };
    expect(summarizeRun(played(LEVEL_1, [2, 2]), contextFor(LEVEL_1), before).isNewBest).toBe(
      false,
    );
  });

  it('gives the level best the save holds after this run (the S7 score line)', () => {
    const best = {
      stars: 3,
      bestScore: 90,
      bestMoves: 2,
      completions: 1,
      firstCompletedOn: '2026-09-01',
    } as const;
    const before = { ...BEFORE, progress: { ...BEFORE.progress, levels: { '1': best } } };
    const won = summarizeRun(played(LEVEL_1, [2, 2]), contextFor(LEVEL_1), before);
    expect([won.score, won.levelBestScore]).toStrictEqual([40, 90]);
    const lost = summarizeRun(played(LEVEL_1, [2, 1, 2]), contextFor(LEVEL_1), BEFORE);
    expect(lost.levelBestScore).toBe(0);
    const endless: RunRef = { kind: 'endless' };
    expect(
      summarizeRun(played(endless, [2]), contextFor(endless), BEFORE).levelBestScore,
    ).toBeNull();
  });

  it('rates daily and endless runs by their saved bests, without stars', () => {
    const daily: RunRef = { kind: 'daily', date: '2026-09-28' };
    const endless: RunRef = { kind: 'endless' };
    expect(summarizeRun(played(daily, [2, 2, 1]), contextFor(daily), BEFORE)).toMatchObject({
      stars: 0,
      isNewBest: true,
      par: null,
    });
    expect(summarizeRun(played(endless, [2, 2, 2, 2, 2]), contextFor(endless), BEFORE).stars).toBe(
      0,
    );
  });

  it('counts an endless loss above the best as a new best', () => {
    const endless: RunRef = { kind: 'endless' };
    const lost = played(endless, [2, 2, 2, 2, 1, 2]);
    expect(lost.outcome.kind).toBe('lost');
    const before = { ...BEFORE, progress: { ...BEFORE.progress, endlessBest: 9 } };
    expect(summarizeRun(lost, contextFor(endless), before)).toMatchObject({
      isWon: false,
      score: 11,
      isNewBest: true,
    });
    const higher = { ...BEFORE, progress: { ...BEFORE.progress, endlessBest: 11 } };
    expect(summarizeRun(lost, contextFor(endless), higher).isNewBest).toBe(false);
  });
});

describe('runEndOf', () => {
  it('turns a finished level into the run-end record with measured counters', () => {
    const session = played(LEVEL_1, [2, 2]);
    const summary = summarizeRun(session, contextFor(LEVEL_1), BEFORE);
    expect(runEndOf(session, summary, contextFor(LEVEL_1))).toStrictEqual({
      isWon: true,
      score: 40,
      moves: 2,
      playMs: 0,
      counters: {
        adds: { value: 2, aggregate: 'sum' },
        'biggest-add': { value: 2, aggregate: 'max' },
      },
      mode: 'level',
      level: 1,
      stars: 3,
    });
  });

  it('records daily, endless and tutorial runs under their own modes', () => {
    const refs: readonly RunRef[] = [
      { kind: 'daily', date: '2026-09-28' },
      { kind: 'endless' },
      { kind: 'tutorial' },
    ];
    const modes = refs.map((ref) => {
      const session = played(ref, [1]);
      return runEndOf(session, summarizeRun(session, contextFor(ref), BEFORE), contextFor(ref))
        .mode;
    });
    expect(modes).toStrictEqual(['daily', 'endless', 'tutorial']);
  });

  it('marks a lost level with the placeholder star value the record ignores', () => {
    const session = played(LEVEL_1, [2, 1, 2]);
    const end = runEndOf(
      session,
      summarizeRun(session, contextFor(LEVEL_1), BEFORE),
      contextFor(LEVEL_1),
    );
    expect(end).toMatchObject({ isWon: false, mode: 'level', stars: 1 });
  });
});
