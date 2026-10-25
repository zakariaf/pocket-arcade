// apps/poker-drop/src/board/build-timeline.test.ts
import fc from 'fast-check';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { cardOf } from '@e07/poker-drop/rules/cards.ts';
import { continueAfterLoss } from '@e07/poker-drop/rules/continue-run.ts';
import { create } from '@e07/poker-drop/rules/create.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';
import { busiestBoardTurn } from '@e07/poker-drop/testing/poker-drop-board-turn.ts';

import { burstEntity, cellEntity, goneEntity, TURN_ENTITY } from './board-ids.ts';
import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { PokerDropEvent, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

const TURN = busiestBoardTurn();
const FULL = buildTimeline(TURN.result.events, 'full');

const on = (tracks: readonly Track[], channel: string, entityId?: number): Track[] =>
  tracks.filter(
    (track) => track.channel === channel && (entityId === undefined || track.entityId === entityId),
  );
const span = (track: Track | undefined) =>
  track === undefined
    ? undefined
    : { startMs: track.startMs, durationMs: track.durationMs, from: track.from, to: track.to };
const cardCount = (state: PokerDropState): number =>
  state.cells.filter((cell) => cell !== null).length;
const sameValues = (a: readonly number[] | undefined, b: readonly number[] | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Every entity's pos tracks in start order. */
function pathsOf(tracks: readonly Track[]): Map<number, Track[]> {
  const paths = new Map<number, Track[]>();
  for (const track of on(tracks, 'pos')) {
    paths.set(track.entityId, [...(paths.get(track.entityId) ?? []), track]);
  }
  for (const path of paths.values()) path.sort((a, b) => a.startMs - b.startMs);
  return paths;
}

/** True when each segment of every path starts where the one before it ended. */
function isContinuous(paths: ReadonlyMap<number, readonly Track[]>): boolean {
  return [...paths.values()].every((path) =>
    path.every((track, i) => i === 0 || sameValues(path[i - 1]?.to, track.from)),
  );
}

/** True when every card left in the well ends its path on its own cell. */
function endsOnFinalCells(state: PokerDropState, paths: ReadonlyMap<number, Track[]>): boolean {
  return state.cells.every((cell, index) => {
    const last = paths.get(cellEntity(index))?.at(-1);
    return (
      cell === null || last === undefined || sameValues(last.to, [index % 5, Math.floor(index / 5)])
    );
  });
}

/** Checks one move's timeline against the states before and after it. */
function checkTurn(
  before: PokerDropState,
  after: PokerDropState,
  events: readonly PokerDropEvent[],
) {
  const tracks = buildTimeline(events, 'full');
  const paths = pathsOf(tracks);
  const risen = events.some((event) => event.kind === 'row-rose') ? 5 : 0;
  // Every card that came in (the drop, a risen row) and is not in the well any more left it once.
  expect(on(tracks, 'gone')).toHaveLength(cardCount(before) + 1 + risen - cardCount(after));
  expect(isContinuous(paths)).toBe(true);
  expect(endsOnFinalCells(after, paths)).toBe(true);
}

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(FULL)).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  // spec 13 and the realtime skill: the cascade is simulated inside applyMove and replayed.
  it('replays each burst at the moment the rules simulated it', () => {
    expect(on(FULL, 'line').map((track) => track.startMs)).toStrictEqual([408, 875, 1542]);
    expect(on(FULL, 'line', burstEntity(0))[0]?.from).toStrictEqual([0, 0, 4, 0]);
  });

  it('follows the dropped card through its fall, the rising row and the fall after the burst', () => {
    expect(on(FULL, 'pos', cellEntity(4)).map(span)).toStrictEqual([
      { startMs: 0, durationMs: 408, from: [4, 6], to: [4, 0] },
      { startMs: 1342, durationMs: 200, from: [4, 0], to: [4, 1] },
      { startMs: 1842, durationMs: 166, from: [4, 1], to: [4, 0] },
    ]);
    expect(span(on(FULL, 'slide', cellEntity(4))[0])).toMatchObject({ startMs: 0, from: [1] });
  });

  it('lets every burst card vanish from the cell it held, after the fall or rise that brought it', () => {
    expect(on(FULL, 'gone')).toHaveLength(12);
    expect(on(FULL, 'gone', goneEntity(0))[0]).toMatchObject({ startMs: 408, from: [48, 0, 0, 0] });
    expect(span(on(FULL, 'pos', goneEntity(4))[0])).toStrictEqual({
      startMs: 708,
      durationMs: 167,
      from: [0, 1],
      to: [0, 0],
    });
    // A card of the risen row comes up from below the well before it bursts.
    expect(on(FULL, 'pos', goneEntity(8))[0]).toMatchObject({ from: [1, -1], to: [1, 0] });
  });

  it('raises every card that did not move otherwise with the one rise track', () => {
    expect(span(on(FULL, 'rise', TURN_ENTITY)[0])).toStrictEqual({
      startMs: 1342,
      durationMs: 200,
      from: [-1],
      to: [0],
    });
    expect(on(FULL, 'pos', cellEntity(0))).toStrictEqual([]);
  });

  it('slides the next card into the hand slot when it is dealt', () => {
    expect(span(on(FULL, 'deal', TURN_ENTITY)[0])).toMatchObject({
      startMs: 2008,
      from: [0],
      to: [1],
    });
  });

  it('pops the cascade badge on the second step only', () => {
    expect(on(FULL, 'step').map((track) => [track.entityId, track.from[2]])).toStrictEqual([
      [burstEntity(1), 2],
    ]);
  });

  it('cues the drop, each hand, the cascade and the rise at their moments', () => {
    const cues = FULL.filter((track) => track.cue !== undefined)
      .map((track) => ({ at: track.startMs, ...track.cue }))
      .sort((a, b) =>
        a.at === b.at ? String(a.sound).localeCompare(String(b.sound)) : a.at - b.at,
      );
    expect(cues).toStrictEqual([
      { at: 408, sound: 'burst-two-pair', haptic: 'medium' },
      { at: 408, sound: 'drop', haptic: 'light' },
      { at: 875, sound: 'burst-two-pair', haptic: 'heavy' },
      { at: 955, sound: 'cascade' },
      { at: 1342, sound: 'rise', haptic: 'light' },
      { at: 1542, sound: 'burst-two-pair', haptic: 'medium' },
    ]);
  });

  it('gives the sound of a step to its strongest hand only', () => {
    const burst = (hand: 'two-pair' | 'flush', line: readonly number[]): PokerDropEvent => ({
      kind: 'hand-burst',
      step: 1,
      hand,
      lineKind: 'row',
      line,
      cells: line,
      cards: line,
      points: 20,
      atMs: 300,
    });
    const tracks = buildTimeline(
      [
        burst('two-pair', [0, 1, 2, 3, 4]),
        burst('flush', [5, 6, 7, 8, 9]),
        burst('two-pair', [10, 11, 12, 13, 14]),
      ],
      'full',
    );
    expect(on(tracks, 'line').map((track) => track.cue?.sound)).toStrictEqual([
      undefined,
      'burst-flush',
      undefined,
    ]);
  });

  it('drops particles and overshoot under reduced motion and plays in half the time', () => {
    const reduced = buildTimeline(TURN.result.events, 'reduced');
    expect(on(reduced, 'burst')).toStrictEqual([]);
    expect(on(FULL, 'burst')).toHaveLength(3);
    expect(reduced.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(reduced)).toBe(timelineEndMs(FULL) / 2);
  });

  it('flashes the well when a rising row overflows it', () => {
    const tracks = buildTimeline([{ kind: 'well-overflowed', atMs: 500 }], 'full');
    expect(tracks).toMatchObject([
      { channel: 'overflow', startMs: 500, cue: { sound: 'overflow', haptic: 'warning' } },
    ]);
  });

  // spec 8.10: the continue clears the top row of the well.
  it('lifts the top row out of the well on the continue', () => {
    const lost = { ...create(2, 0), cells: create(2, 0).cells.map((_, index) => index % 52) };
    const tracks = buildTimeline(continueAfterLoss(lost).events, 'full');
    expect(on(tracks, 'gone')).toHaveLength(5);
    expect(on(tracks, 'gone', goneEntity(0))[0]).toMatchObject({
      from: [25, 0, 5, 1],
      cue: { sound: 'continue', haptic: 'success' },
    });
  });

  it('returns the same tracks for the same events', () => {
    expect(buildTimeline(TURN.result.events, 'full')).toStrictEqual(FULL);
  });

  it('accounts for every card of every move: paths join up and end on the final cells', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 24 }),
        (seed, difficulty, choices) => {
          let state = create(seed, difficulty);
          for (const choice of choices) {
            const moves = listMoves(state);
            const move = moves[choice % Math.max(1, moves.length)];
            if (move === undefined) return;
            const result = applyMove(state, move);
            checkTurn(state, result.state, result.events);
            state = result.state;
          }
        },
      ),
      { seed: 41, numRuns: 60 },
    );
  });

  it('pins a card of the cascade: the king of diamonds bursts first, from the bottom row', () => {
    expect(on(FULL, 'gone', goneEntity(3))[0]?.from).toStrictEqual([cardOf(13, 2), 3, 0, 0]);
  });
});
