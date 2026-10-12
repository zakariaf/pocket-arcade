// packages/shell/src/screens/settings/use-settings-links.test.tsx
import { act, renderHook } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_GAME_EXTRA } from '@e07/shell/testing/test-game-extra.ts';

import { useSettingsLinks } from './use-settings-links.ts';

jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

let mockAppStoreId: string | undefined;
jest.mock('@e07/shell/app/use-game-extra.ts', () => ({
  useGameExtra: () => ({
    ...jest.requireActual<{ TEST_GAME_EXTRA: object }>('@e07/shell/testing/test-game-extra.ts')
      .TEST_GAME_EXTRA,
    ...(mockAppStoreId === undefined ? {} : { appStoreId: mockAppStoreId }),
  }),
}));

async function links(appStoreId: string | undefined) {
  mockAppStoreId = appStoreId;
  const errorLog = createFakeErrorLog();
  const { wrapper } = createShellWrapper({ services: { errorLog } });
  const { result } = await renderHook(() => useSettingsLinks('1.0.0 (8)'), { wrapper });
  return { links: result.current, errorLog };
}

describe('useSettingsLinks', () => {
  it('hands Rate to the App Store and Contact to the mail app', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { links: handlers } = await links('6740000001');
    handlers.onRate();
    handlers.onContact();

    expect(openUrl.mock.calls.map(([url]) => new URL(url).pathname)).toStrictEqual([
      '/app/id6740000001',
      TEST_GAME_EXTRA.links.supportEmail,
    ]);
  });

  it('does nothing for Rate before the game has an App Store id', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { links: handlers } = await links(undefined);
    handlers.onRate();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('hands Rate to Google Play on Android, on the web when there is no Play Store (spec S11)', async () => {
    // Spec S11: "Rate this game: opens the store page. The store app handles this; the game
    // itself makes no request." Android's store is Google Play, known by the build's package.
    jest.replaceProperty(Platform, 'OS', 'android');
    const openUrl = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('no app for market'))
      .mockResolvedValueOnce(undefined);
    const { links: handlers, errorLog } = await links(undefined);
    await act(async () => {
      handlers.onRate();
      await flushMicrotasks();
    });

    expect(
      openUrl.mock.calls.map(([url]) => {
        const { protocol, host, search } = new URL(url);
        return [protocol, host, search];
      }),
    ).toStrictEqual([
      ['market:', 'details', '?id=io.applander.linesiege'],
      ['https:', 'play.google.com', '?id=io.applander.linesiege'],
    ]);
    expect(errorLog.entries()).toStrictEqual([]);
  });
});
