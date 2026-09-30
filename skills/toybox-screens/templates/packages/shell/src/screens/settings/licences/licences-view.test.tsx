// packages/shell/src/screens/settings/licences/licences-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { shellLicenceEntries } from './licence-entries.ts';
import { LicencesView } from './licences-view.tsx';

import type { LicencesModel } from './licences-view.tsx';

const KEYS = [
  'lilita-one',
  'rubik',
  'react-native',
  'react',
  'expo',
  'react-native-skia',
  'skia',
  'react-native-reanimated',
  'react-native-gesture-handler',
  'formatjs-react-intl',
  'zustand',
  'react-native-google-mobile-ads',
  'google-mobile-ads-sdk',
  'expo-iap',
  'game-sounds',
];

function modelWith(onShowText: (key: string) => void): LicencesModel {
  return {
    gameName: 'Line Siege',
    entries: shellLicenceEntries((key) => key),
    isReducedMotion: false,
    onBack: jest.fn(),
    onShowText,
  };
}

describe('LicencesView', () => {
  it('draws every S11d group and row with its design testID', async () => {
    await renderWithShell(<LicencesView model={modelWith(jest.fn())} />);

    const groups = ['fonts', 'software', 'ads-store', 'sounds'].flatMap((id) => [
      `licences.group.${id}.tab`,
      `licences.group.${id}.list`,
    ]);
    const rows = KEYS.flatMap((key) => [
      `licences.entry-row.${key}`,
      `licences.entry-row.${key}.label`,
      `licences.entry-row.${key}.licence`,
    ]);
    for (const testID of [
      'licences.screen',
      'licences.intro',
      'licences.entry-row.vazirmatn.description',
      'licences.entry-row.vazirmatn.show-text-button',
      ...groups,
      ...rows,
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('opens a licence text from its row and from the nudge', async () => {
    const onShowText = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(<LicencesView model={modelWith(onShowText)} />);

    await user.press(screen.getByTestId('licences.entry-row.zustand'));
    await user.press(screen.getByTestId('licences.entry-row.vazirmatn.show-text-button'));

    expect(onShowText).toHaveBeenNthCalledWith(1, 'zustand');
    expect(onShowText).toHaveBeenNthCalledWith(2, 'vazirmatn');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
