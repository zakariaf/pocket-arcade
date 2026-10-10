// packages/shell/src/screens/pause/use-pause-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { usePauseModel } from './use-pause-model.ts';

import type { PauseSession } from './pause-model.ts';
import type { HostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

const mockNavigate = jest.fn();
const mockOpenDialog = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@e07/shell/app/dialog-context.tsx', () => ({ useOpenDialog: () => mockOpenDialog }));

type Setup = {
  readonly hasMusic?: boolean;
  readonly canVibrate?: boolean;
  readonly moves?: number;
};

/** A paused level-2 run of the tally game after `moves` taps that add one (its target is 5). */
function pausedRun(shell: HostWrapper, moves: number): PauseSession & { startRun: jest.Mock } {
  const opened = shell.host.openSession({ start: 'new', ref: { kind: 'level', level: 2 } });
  if (opened === null) throw new Error('no run');
  // Column 0 adds one (the tap-then-tap selection is the board host's; a plain tap has none).
  const addOne = {
    kind: 'tap',
    target: { regionId: 'board', col: 0, row: 0 },
    selected: null,
  } as const;
  for (let move = 0; move < moves; move += 1) {
    opened.handle.send({ type: 'intent', intent: addOne });
  }
  opened.handle.send({ type: 'pause' });
  return { view: opened.handle.getView(), startRun: jest.fn() };
}

async function pauseModel({ hasMusic = false, canVibrate = true, moves = 1 }: Setup = {}) {
  const audio = createFakeAudio();
  const shell = createHostWrapper({
    host: { hasMusic },
    services: { audio, haptics: createFakeHaptics(canVibrate) },
  });
  const session = pausedRun(shell, moves);
  const view = await renderHook(() => usePauseModel(session), { wrapper: shell.wrapper });
  return { ...view, session, audio, shell };
}

describe('usePauseModel', () => {
  it('names the run and shows Sound and Vibration, and Music only for a game with music', async () => {
    const plain = await pauseModel();
    expect(plain.result.current).toMatchObject({ modeText: 'Level 2', music: null });
    expect(plain.result.current.sound.isOn).toBe(true);
    expect(plain.result.current.vibration?.isOn).toBe(true);

    const musical = await pauseModel({ hasMusic: true, canVibrate: false });
    // Music starts off (the design draws Sound on, Music off).
    expect(musical.result.current.music?.isOn).toBe(false);
    expect(musical.result.current.vibration).toBeNull();
  });

  it('flips a toggle key through the settings store with the toggle feedback', async () => {
    const { result, shell, audio } = await pauseModel();
    await act(() => {
      result.current.sound.onToggle();
    });
    expect(shell.stores.settings.getState().settings.soundEnabled).toBe(false);
    expect(result.current.sound.isOn).toBe(false);
    expect(audio.calls).toContainEqual({ kind: 'play', soundId: 'ui.toggle', delayMs: 0 });
  });

  it('restarts a short run at once and asks first once more moves would be lost', async () => {
    const short = await pauseModel({ moves: 2 });
    short.result.current.onRestart();
    expect(short.session.startRun).toHaveBeenCalledWith({ kind: 'level', level: 2 });

    const long = await pauseModel({ moves: 4 });
    long.result.current.onRestart();
    expect(long.session.startRun).not.toHaveBeenCalled();
    expect(mockOpenDialog).toHaveBeenCalledWith({
      kind: 'restart-level',
      onRestart: expect.any(Function),
    });
  });

  it('opens How to play over the paused run', async () => {
    const { result } = await pauseModel();
    result.current.onHowToPlay();
    expect(mockNavigate).toHaveBeenCalledWith('HowToPlay');
  });
});
