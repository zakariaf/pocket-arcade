// packages/shell/src/game-host/board-host-model.test.ts
import {
  boardHandlersFor,
  createMoveResultSelector,
  highlightOf,
  hintedTargetsOf,
  motionOf,
  routeIntent,
  selectedAt,
} from './board-host-model.ts';

import type { SessionCommand, SessionHandle } from './session-view.ts';

type Tally = { readonly count: number };

function recordingHandle(): SessionHandle & { readonly sent: SessionCommand[] } {
  const sent: SessionCommand[] = [];
  return {
    sent,
    getView: () => {
      throw new Error('the board handlers never read the view');
    },
    subscribe: () => () => undefined,
    send: (command) => {
      sent.push(command);
    },
  };
}

describe('createMoveResultSelector', () => {
  it('keeps one result object until the next applied, undone or continued move', () => {
    const select = createMoveResultSelector<Tally, string>();
    const first = select({ eventSeq: 1, state: { count: 1 }, lastEvents: ['added'] });
    expect(first).toStrictEqual({ seq: 1, state: { count: 1 }, events: ['added'] });
    expect(select({ eventSeq: 1, state: { count: 1 }, lastEvents: ['added'] })).toBe(first);
    const next = select({ eventSeq: 2, state: { count: 3 }, lastEvents: ['added'] });
    expect(next).not.toBe(first);
    expect(next.seq).toBe(2);
  });
});

describe('motionOf', () => {
  it('turns the Reduce motion setting into the timeline motion', () => {
    expect([motionOf(true), motionOf(false)]).toStrictEqual(['reduced', 'full']);
  });
});

describe('boardHandlersFor', () => {
  it('sends board intents to the run as intent commands', () => {
    const handle = recordingHandle();
    const intent = {
      kind: 'tap',
      target: { regionId: 'board', col: 1, row: 0 },
      selected: null,
    } as const;
    boardHandlersFor(handle, { record: jest.fn(), entries: () => [] }).onIntent(intent);
    expect(handle.sent).toStrictEqual([{ type: 'intent', intent }]);
  });

  it('pauses the run and logs a frame failure, and logs audio errors without pausing', () => {
    const handle = recordingHandle();
    const record = jest.fn();
    const handlers = boardHandlersFor(handle, { record, entries: () => [] });
    handlers.onFailure('draw threw');
    handlers.reportError(new Error('session interrupted'));
    expect(handle.sent).toStrictEqual([{ type: 'pause' }]);
    expect(record.mock.calls).toStrictEqual([
      ['frame-callback', new Error('draw threw')],
      ['audio', new Error('session interrupted')],
    ]);
  });
});

const SLOT_0 = { regionId: 'tray', col: 0, row: 0 } as const;
const SLOT_1 = { regionId: 'tray', col: 1, row: 0 } as const;
const CELL = { regionId: 'board', col: 2, row: 3 } as const;
const TRAY = ['tray'];
const tapOn = (target: typeof SLOT_0 | typeof SLOT_1 | typeof CELL) =>
  ({ kind: 'tap', target, selected: null }) as const;

describe('routeIntent (tap-then-tap)', () => {
  it('selects a target in a select region and sends nothing', () => {
    const route = routeIntent({
      intent: tapOn(SLOT_0),
      selected: null,
      seq: 4,
      selectRegions: TRAY,
    });
    expect(route).toStrictEqual({
      selection: { target: SLOT_0, seq: 4 },
      intent: null,
      announce: 'selected',
    });
  });

  it('toggles: the same target again clears it, another one replaces it', () => {
    const again = routeIntent({
      intent: tapOn(SLOT_0),
      selected: SLOT_0,
      seq: 4,
      selectRegions: TRAY,
    });
    expect(again).toStrictEqual({ selection: null, intent: null, announce: 'unselected' });
    const other = routeIntent({
      intent: tapOn(SLOT_1),
      selected: SLOT_0,
      seq: 4,
      selectRegions: TRAY,
    });
    expect(other.selection).toStrictEqual({ target: SLOT_1, seq: 4 });
  });

  it('carries the selection to intentToMove with the next tap and keeps it until a move lands', () => {
    const route = routeIntent({
      intent: tapOn(CELL),
      selected: SLOT_0,
      seq: 4,
      selectRegions: TRAY,
    });
    expect(route).toStrictEqual({
      selection: { target: SLOT_0, seq: 4 },
      intent: { kind: 'tap', target: CELL, selected: SLOT_0 },
      announce: null,
    });
  });

  it('lets a drag ignore the selection and clear it', () => {
    const drag = { kind: 'drag-end', from: SLOT_1, to: CELL } as const;
    expect(
      routeIntent({ intent: drag, selected: SLOT_0, seq: 4, selectRegions: TRAY }),
    ).toStrictEqual({ selection: null, intent: drag, announce: null });
  });

  it('treats every tap as an action when the game has no select regions', () => {
    const route = routeIntent({ intent: tapOn(SLOT_0), selected: null, seq: 1, selectRegions: [] });
    expect(route.intent).toStrictEqual({ kind: 'tap', target: SLOT_0, selected: null });
  });
});

describe('selectedAt', () => {
  it('shows a selection only at the eventSeq it was made at', () => {
    const selection = { target: SLOT_0, seq: 4 };
    expect([selectedAt(selection, 4), selectedAt(selection, 5), selectedAt(null, 4)]).toStrictEqual(
      [SLOT_0, null, null],
    );
  });
});

describe('hintedTargetsOf and highlightOf', () => {
  const board = { targetsOfMove: (_state: number, move: number) => [{ ...CELL, col: move }] };

  it('outlines the hinted move through the board, or nothing', () => {
    expect(hintedTargetsOf(board, 0, 5)).toStrictEqual([{ ...CELL, col: 5 }]);
    expect(hintedTargetsOf(board, 0, null)).toStrictEqual([]);
    expect(hintedTargetsOf({}, 0, 5)).toStrictEqual([]);
  });

  it('adds the tutorial pointer cells to the hinted ones', () => {
    expect(highlightOf(SLOT_0, [CELL], [SLOT_1])).toStrictEqual({
      selected: SLOT_0,
      hinted: [CELL, SLOT_1],
    });
  });
});
