// packages/shell/src/screens/settings/use-settings-links.test.tsx
import { renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_GAME_EXTRA } from '@e07/shell/testing/test-game-extra.ts';

import { useSettingsLinks } from './use-settings-links.ts';

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
});
