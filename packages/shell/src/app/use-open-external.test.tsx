// packages/shell/src/app/use-open-external.test.tsx
import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { licenceTextUrl, playStoreUrls } from '@e07/shell/config/external-links.ts';
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

  it('stops at the first URL of a list that opens', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const urls = playStoreUrls('io.applander.linesiege');
    const { open } = await openExternal();
    await act(async () => {
      open(urls);
      await flushMicrotasks();
    });
    expect(openUrl.mock.calls).toStrictEqual([[urls?.[0]]]);
  });

  it('tries the next URL when no app takes one, and logs only when none does', async () => {
    // Android: a phone without the Play Store has no app for market:, so the web page opens.
    const urls = playStoreUrls('io.applander.linesiege');
    const openUrl = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('no app for market'))
      .mockResolvedValueOnce(undefined);
    const first = await openExternal();
    await act(async () => {
      first.open(urls);
      await flushMicrotasks();
    });
    expect(openUrl.mock.calls).toStrictEqual([[urls?.[0]], [urls?.[1]]]);
    expect(first.errorLog.entries()).toStrictEqual([]);

    openUrl.mockReset();
    openUrl
      .mockRejectedValueOnce(new Error('no app for market'))
      .mockRejectedValueOnce(new Error('no browser'));
    const second = await openExternal();
    await act(async () => {
      second.open(urls);
      await flushMicrotasks();
    });
    expect(second.errorLog.entries().map((entry) => [entry.source, entry.message])).toStrictEqual([
      ['hand-off', 'no browser'],
    ]);
  });
});
