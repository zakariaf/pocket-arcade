// apps/trail-clear/src/saved-run.test.ts
// Spec 8.6, 8.14 and N10: a saved run whose move log the rules refuse keeps its position and loses
// only its undo history, and the boot never throws. parseMove sees one move without the state, so
// it cannot know which turns the offered tile has or whether a cell fits: the Shell's resume
// replays the log, and a move applyMove refuses is written to the error log and dropped there.
import { newSession, resumeSession } from '@e07/shell/game-host/open-session.ts';
import { toSavedRun } from '@e07/shell/game-host/saved-run.ts';
import { TRAIL_CLEAR_STATE_VERSION } from '@e07/trail-clear/rules/trail-clear-persistence.ts';

import { trailClearGame } from './index.ts';

/** The `run` section of the save, as the Shell writes it. */
type SaveRun = ReturnType<typeof toSavedRun>;

function errorLog() {
  const recorded: string[] = [];
  return {
    port: {
      record: (_source: string, error: unknown) => {
        recorded.push(error instanceof Error ? error.message : String(error));
      },
      entries: () => [],
    },
    recorded,
  };
}

/** Level 1's run as saved before any move, with `log` as its move log. */
function savedWithLog(log: SaveRun['log']): SaveRun {
  const session = newSession(trailClearGame, { kind: 'level', level: 1 }, () => 0);
  if (session === null) throw new Error('no level 1');
  return { ...toSavedRun(session, TRAIL_CLEAR_STATE_VERSION, true), log };
}

describe('a saved Trail Clear run with a move log the rules refuse', () => {
  it.each([
    [
      'a cell off the board (parseMove refuses it)',
      { kind: 'place-tile', turns: 3, col: 9, row: 0 },
    ],
    [
      'a cell the offered tile does not match, so applyMove refuses it',
      { kind: 'place-tile', turns: 0, col: 0, row: 0 },
    ],
  ])('keeps the position and drops only the undo history (%s)', (_, move) => {
    const saved = savedWithLog([{ kind: 'move', move }]);
    const log = errorLog();
    const session = resumeSession(trailClearGame, saved, log.port);
    expect(session?.state).toStrictEqual(saved.state);
    expect(session?.past).toStrictEqual([]);
    expect(session?.hasPartialLog).toBe(true);
    expect(log.recorded.length).toBeGreaterThan(0);
  });
});
