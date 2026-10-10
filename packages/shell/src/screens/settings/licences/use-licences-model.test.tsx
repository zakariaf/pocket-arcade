// packages/shell/src/screens/settings/licences/use-licences-model.test.tsx
import { renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { useLicencesModel } from './use-licences-model.ts';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));

const WORD_LIST = {
  kind: 'word-list',
  name: 'ENABLE word list',
  version: '2',
  license: 'LicenseRef-Public-Domain',
  copyright: 'Public domain',
  source: 'example.com/enable',
} as const;

describe('useLicencesModel', () => {
  it("lists the Shell's rows first, then the game's own credits", async () => {
    const shell = createHostWrapper({ host: { credits: [WORD_LIST] } });
    const { result } = await renderHook(() => useLicencesModel(), { wrapper: shell.wrapper });
    const keys = result.current.entries.map((entry) => entry.key);

    expect(result.current.gameName).toBe('Tally');
    expect(keys.slice(0, 3)).toStrictEqual(['vazirmatn', 'lilita-one', 'rubik']);
    expect(keys.at(-1)).toBe('game-enable-word-list');
    expect(result.current.entries.at(-1)).toMatchObject({
      group: 'software',
      licence: 'LicenseRef-Public-Domain',
    });
  });

  it("hands the opened row's licence text to the browser, and nothing for a row without one", async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const shell = createHostWrapper({ host: { credits: [WORD_LIST] } });
    const { result } = await renderHook(() => useLicencesModel(), { wrapper: shell.wrapper });

    result.current.onShowText('rubik');
    result.current.onShowText('game-enable-word-list');
    result.current.onShowText('not-a-row');
    expect(openUrl.mock.calls.map(([url]) => new URL(url).pathname)).toStrictEqual([
      '/licenses/OFL-1.1.html',
    ]);
  });
});
