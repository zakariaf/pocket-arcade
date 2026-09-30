// packages/shell/src/app/use-direction-restart.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { restartForDirection } from '@e07/shell/i18n/direction.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useDirectionRestart } from './use-direction-restart.ts';

jest.mock('@e07/shell/i18n/direction.ts', () => ({
  readLayoutDirection: () => 'ltr',
  restartForDirection: jest.fn(() => Promise.resolve()),
}));
jest.mock('@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts', () => ({
  createSqliteKvDirectionGuardAdapter: () => ({ readPending: () => null, writePending: jest.fn() }),
}));

describe('useDirectionRestart', () => {
  it('disposes audio first, then restarts in the new direction', async () => {
    const audio = createFakeAudio();
    const { wrapper } = createShellWrapper({ services: { audio, errorLog: createFakeErrorLog() } });
    const { result } = await renderHook(() => useDirectionRestart(), { wrapper });

    await act(async () => {
      result.current('rtl');
      await Promise.resolve();
    });

    expect(audio.calls).toStrictEqual([{ kind: 'dispose' }]);
    expect(jest.mocked(restartForDirection)).toHaveBeenCalledWith('rtl', expect.anything());
  });

  it('logs a failed restart instead of throwing', async () => {
    const errorLog = createFakeErrorLog();
    const audio = { ...createFakeAudio(), dispose: () => Promise.reject(new Error('busy')) };
    const { wrapper } = createShellWrapper({ services: { audio, errorLog } });
    const { result } = await renderHook(() => useDirectionRestart(), { wrapper });

    await act(async () => {
      result.current('ltr');
      await Promise.resolve();
    });

    expect(errorLog.entries().map((entry) => entry.message)).toStrictEqual(['busy']);
  });
});
