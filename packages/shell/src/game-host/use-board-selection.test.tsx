// packages/shell/src/game-host/use-board-selection.test.tsx
// no-shell-context: the hook reads only the run's session store and its handle, built here.
import { act, renderHook } from '@testing-library/react-native';

import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { boardHandlersFor } from './board-host-model.ts';
import { createGameHost } from './game-host.ts';
import { useBoardSelection } from './use-board-selection.ts';

import type { BoardHostInput, GameHost } from './game-host.ts';
import type { ShellGameModule } from './shell-game-module.ts';
import type { BoardSelectionInput } from './use-board-selection.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { TallyTypes } from '@e07/shell/testing/tally-game.ts';

/** Tally as tap-then-tap: pick an amount in the picker (column 0 adds 1, 1 adds 2), tap the board. */
const PICK_TALLY: ShellGameModule<TallyTypes> = {
  ...TALLY_GAME,
  engine: {
    ...TALLY_GAME.engine,
    selectRegions: ['picker'],
    intentToMove: (state, intent) => {
      if (intent.kind !== 'tap' || intent.target.regionId !== 'board') return null;
      if (intent.selected === null) return null;
      const target = { regionId: 'board', col: intent.selected.col, row: 0 };
      return TALLY_GAME.engine.intentToMove(state, { ...intent, target });
    },
  },
};

const pick = (col: number): InputIntent => ({
  kind: 'tap',
  target: { regionId: 'picker', col, row: 0 },
  selected: null,
});
const PLACE: InputIntent = {
  kind: 'tap',
  target: { regionId: 'board', col: 3, row: 0 },
  selected: null,
};

type Runs = { readonly host: GameHost; readonly inputs: BoardHostInput<TallyTypes>[] };

function hostWithBoards(): Runs {
  const { save } = createTestSave();
  const inputs: BoardHostInput<TallyTypes>[] = [];
  const host = createGameHost(PICK_TALLY, {
    save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: (input) => {
      // The factory is generic; this host only ever opens the pick-tally game.
      inputs.push(input as unknown as BoardHostInput<TallyTypes>);
      return () => null;
    },
    writeRunEnd: (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  });
  return { host, inputs };
}

function openLevel(runs: Runs): BoardSelectionInput<TallyTypes> {
  runs.host.openSession({ start: 'new', ref: { kind: 'level', level: 2 } });
  const input = runs.inputs.at(-1);
  if (input === undefined) throw new Error('no board host');
  return {
    game: input.game,
    controller: input.controller,
    send: boardHandlersFor(input.controller.handle, { record: jest.fn(), entries: () => [] })
      .onIntent,
    announce: jest.fn(),
    coachTargets: [],
  };
}

function render(input: BoardSelectionInput<TallyTypes>) {
  return renderHook((props: BoardSelectionInput<TallyTypes>) => useBoardSelection(props), {
    initialProps: input,
  });
}

const moveCountOf = (input: BoardSelectionInput<TallyTypes>): number =>
  input.controller.handle.getView().moveCount;

describe('useBoardSelection', () => {
  it('selects a picker slot and toggles it off again, telling VoiceOver both times', async () => {
    const input = openLevel(hostWithBoards());
    const { result } = await render(input);
    await act(() => {
      result.current.onIntent(pick(1));
    });
    expect(result.current.highlight.selected).toStrictEqual({ regionId: 'picker', col: 1, row: 0 });
    await act(() => {
      result.current.onIntent(pick(1));
    });
    expect(result.current.highlight.selected).toBeNull();
    expect(input.announce).toHaveBeenNthCalledWith(1, 'selected');
    expect(input.announce).toHaveBeenNthCalledWith(2, 'unselected');
    expect(moveCountOf(input)).toBe(0);
  });

  it('places the picked amount with the next board tap and then clears the selection', async () => {
    const input = openLevel(hostWithBoards());
    const { result } = await render(input);
    await act(() => {
      result.current.onIntent(PLACE);
    });
    expect(moveCountOf(input)).toBe(0);
    await act(() => {
      result.current.onIntent(pick(1));
    });
    await act(() => {
      result.current.onIntent(PLACE);
    });
    expect(input.controller.store.getState().session.state.count).toBe(2);
    expect(result.current.highlight.selected).toBeNull();
  });

  it('clears the selection on undo', async () => {
    const input = openLevel(hostWithBoards());
    const { result } = await render(input);
    await act(() => {
      result.current.onIntent(pick(0));
    });
    await act(() => {
      result.current.onIntent(PLACE);
    });
    await act(() => {
      result.current.onIntent(pick(1));
    });
    expect(result.current.highlight.selected).not.toBeNull();
    await act(() => {
      input.controller.handle.send({ type: 'undo' });
    });
    expect(moveCountOf(input)).toBe(0);
    expect(result.current.highlight.selected).toBeNull();
  });

  it('starts a restarted run without the old selection', async () => {
    const runs = hostWithBoards();
    const first = openLevel(runs);
    const { result, rerender } = await render(first);
    await act(() => {
      result.current.onIntent(pick(0));
    });
    await rerender(openLevel(runs));
    expect(result.current.highlight.selected).toBeNull();
  });

  it('outlines the bought hint through the board and the tutorial pointer cells', async () => {
    const input = openLevel(hostWithBoards());
    const coached = { ...input, coachTargets: [{ regionId: 'board', col: 0, row: 0 }] };
    const { result } = await render(coached);
    expect(result.current.highlight.hinted).toStrictEqual([{ regionId: 'board', col: 0, row: 0 }]);
    await act(() => {
      input.controller.handle.send({ type: 'hint' });
    });
    expect(result.current.highlight.hinted).toStrictEqual([
      { regionId: 'board', col: 1, row: 0 },
      { regionId: 'board', col: 0, row: 0 },
    ]);
  });
});
