// packages/shell/src/services/audio/use-audio-lifecycle.test.ts
// no-shell-context: the lifecycle hook takes the audio port and the full-screen gate as arguments.
import { renderHook } from '@testing-library/react-native';

import { createFakeAudio } from './fake-audio.ts';
import { useAudioLifecycle } from './use-audio-lifecycle.ts';

// The foreground check is replaced by a switch the test flips (AppState is not driven in Jest).
jest.mock('@e07/shell/app/use-is-app-active.ts', () => {
  const appState = { isActive: true };
  return { appState, useIsAppActive: () => appState.isActive };
});

const { appState } = jest.requireMock<{ appState: { isActive: boolean } }>(
  '@e07/shell/app/use-is-app-active.ts',
);

type Props = { readonly isFullscreenAdShowing: boolean };

async function mountLifecycle(audio: ReturnType<typeof createFakeAudio>) {
  const reportError = jest.fn();
  const { rerender } = await renderHook(
    (props: Props) => {
      useAudioLifecycle({ audio, reportError, ...props });
    },
    { initialProps: { isFullscreenAdShowing: false } },
  );
  return { rerender, reportError };
}

describe('useAudioLifecycle', () => {
  beforeEach(() => {
    appState.isActive = true;
  });

  it('suspends the context while a full-screen ad shows and resumes it afterwards', async () => {
    const audio = createFakeAudio();
    const { rerender, reportError } = await mountLifecycle(audio);
    await rerender({ isFullscreenAdShowing: true });
    await rerender({ isFullscreenAdShowing: false });
    expect(audio.calls.map((call) => call.kind)).toStrictEqual(['resume', 'suspend', 'resume']);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('suspends the context when the app leaves the foreground', async () => {
    const audio = createFakeAudio();
    const { rerender } = await mountLifecycle(audio);
    appState.isActive = false;
    await rerender({ isFullscreenAdShowing: false });
    expect(audio.calls.map((call) => call.kind)).toStrictEqual(['resume', 'suspend']);
  });

  it('reports a failed suspend instead of throwing into the UI', async () => {
    const audio = { ...createFakeAudio(), suspend: () => Promise.reject(new Error('busy')) };
    const reportError = jest.fn();
    await renderHook(() => {
      useAudioLifecycle({ audio, reportError, isFullscreenAdShowing: true });
    });
    await Promise.resolve();
    expect(reportError).toHaveBeenCalledWith(new Error('busy'));
  });
});
