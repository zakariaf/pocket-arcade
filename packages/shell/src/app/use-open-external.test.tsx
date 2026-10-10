// packages/shell/src/app/use-open-external.test.tsx
import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { licenceTextUrl } from '@e07/shell/config/external-links.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useOpenExternal } from './use-open-external.ts';

async function openExternal() {
  const errorLog = createFakeErrorLog();
  const { wrapper } = createShellWrapper({ services: { errorLog } });
  const { result } = await renderHook(() => useOpenExternal(), { wrapper });
  return { open: result.current, errorLog };
}

// Spec N3, S11 and S11d: hand-offs open another app; the Shell makes no request of its own.
describe('useOpenExternal', () => {
  it('hands the URL to iOS', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const url = licenceTextUrl('MIT');
    const { open } = await openExternal();
    open(url);
    expect(openUrl.mock.calls).toStrictEqual([[url]]);
  });

  it('opens nothing without a URL', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { open } = await openExternal();
    open(null);
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('logs a failed hand-off instead of showing it', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no app for the URL'));
    const { open, errorLog } = await openExternal();
    await act(async () => {
      open(licenceTextUrl('MIT'));
      await flushMicrotasks();
    });
    expect(errorLog.entries().map((entry) => [entry.source, entry.message])).toStrictEqual([
      ['hand-off', 'no app for the URL'],
    ]);
  });
});
