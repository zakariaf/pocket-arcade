// packages/shell/src/screens/first-run/use-tutorial-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { GameHostProvider } from '@e07/shell/game-host/game-host-context.tsx';
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { I18nProvider } from '@e07/shell/i18n/i18n-provider.tsx';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { useTutorialModel } from './use-tutorial-model.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { GameHostDeps } from '@e07/shell/game-host/game-host.ts';
import type { SessionCommand, SessionHandle } from '@e07/shell/game-host/session-view.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { ReactNode } from 'react';

const mockDispatch = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: jest.fn(),
  useIsFocused: () => true,
}));

/** The tally game ships empty catalogs; the tutorial reads its name and its two steps. */
const TALLY_TEXTS = {
  'tally.name': 'Tally',
  'tally.tutorial.add-one': 'Tap the left column to add one.',
  'tally.tutorial.add-two': 'Now add two to hit the target.',
};
const CATALOGS = { en: TALLY_TEXTS, de: TALLY_TEXTS, fa: TALLY_TEXTS, ckb: TALLY_TEXTS };

function failOnMissingMessage(error: Error): never {
  throw error;
}

function tapColumn(col: number): InputIntent {
  return { kind: 'tap', target: { regionId: 'board', col, row: 0 }, selected: null };
}

/** The host the composition root builds, with a board factory that hands the test the run. */
function hostFor(save: SaveService, onRun: (handle: SessionHandle) => void) {
  const deps: GameHostDeps = {
    save,
    clock: TEST_CLOCK,
    errorLog: { record: jest.fn(), entries: () => [] },
    isContinueAllowed: true,
    createBoardHost: ({ controller }) => {
      onRun(controller.handle);
      return () => null;
    },
    writeRunEnd: (write) => {
      save.update(write.recipe, { refreshBackup: write.refreshBackup });
    },
    feedback: { audio: createFakeAudio(), haptics: createFakeHaptics() },
  };
  return createGameHost(TALLY_GAME, deps);
}

/** renderWithShell's providers, the game's texts and the game host around the Tutorial model. */
async function tutorial() {
  const { save } = createTestSave();
  const shell = createShellWrapper({ services: { save, clock: TEST_CLOCK } });
  let handle: SessionHandle | null = null;
  const host = hostFor(save, (opened) => {
    handle = opened;
  });
  const ShellRoot = shell.wrapper;
  const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
    <ShellRoot>
      <I18nProvider
        language="en"
        digits="latin"
        gameCatalogs={CATALOGS}
        onError={failOnMissingMessage}
      >
        <GameHostProvider host={host}>{children}</GameHostProvider>
      </I18nProvider>
    </ShellRoot>
  );
  const view = await renderHook(() => useTutorialModel(), { wrapper });
  const send = async (command: SessionCommand): Promise<void> => {
    await act(() => {
      handle?.send(command);
    });
  };
  return { ...view, save, stores: shell.stores, send };
}

describe('useTutorialModel', () => {
  it('opens the scripted tutorial run on its first step: welcome, sentence, pointer, no Skip', async () => {
    const { result, save } = await tutorial();
    const model = result.current;
    expect(stripIsolates(model.welcomeText ?? '')).toBe('Welcome to Tally!');
    expect(model.coachText).toBe('Tap the left column to add one.');
    expect(model.coachTargets).toStrictEqual([{ regionId: 'board', col: 0, row: 0 }]);
    expect([model.skipKey, model.continueKey]).toStrictEqual([null, null]);
    expect(model.BoardHost).not.toBeNull();
    expect(save.doc().run?.ref).toStrictEqual({ kind: 'tutorial' });
  });

  it('accepts only the step it expects, then shows the next step with Skip', async () => {
    const { result, send } = await tutorial();
    await send({ type: 'intent', intent: tapColumn(1) });
    expect(result.current.coachText).toBe('Tap the left column to add one.');
    await send({ type: 'intent', intent: tapColumn(0) });
    expect(result.current.coachText).toBe('Now add two to hit the target.');
    expect(result.current.welcomeText).toBeNull();
    expect(result.current.skipKey?.label).toBe('Skip');
  });

  it('asks for a tap while paused, and the continue key resumes the run', async () => {
    const { result, send } = await tutorial();
    await send({ type: 'pause' });
    expect(result.current.coachText).toBe('Tap to continue');
    await act(() => {
      result.current.continueKey?.onPress();
    });
    expect(result.current.coachText).toBe('Tap the left column to add one.');
    expect(result.current.continueKey).toBeNull();
  });

  it('ends the FirstRun group with Skip and leaves no tutorial run in the save', async () => {
    const { result, send, save, stores } = await tutorial();
    await send({ type: 'intent', intent: tapColumn(0) });
    await act(() => {
      result.current.skipKey?.onPress();
    });
    expect(stores.settings.getState().firstRun.tutorialDone).toBe(true);
    expect(save.doc().run).toBeNull();
  });

  it('congratulates once the script is played, and its continue key finishes the tutorial', async () => {
    const { result, send, stores } = await tutorial();
    await send({ type: 'intent', intent: tapColumn(0) });
    await send({ type: 'intent', intent: tapColumn(1) });
    expect(result.current.coachText).toBe('Nice! You’re ready to play.');
    expect(result.current.skipKey).toBeNull();
    await act(() => {
      result.current.continueKey?.onPress();
    });
    expect(stores.settings.getState().firstRun.tutorialDone).toBe(true);
  });
});
