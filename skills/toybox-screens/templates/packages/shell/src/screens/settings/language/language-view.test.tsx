// packages/shell/src/screens/settings/language/language-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { SettingsLanguageView } from './language-view.tsx';

import type { SettingsLanguageModel } from './language-view.tsx';

function modelWith(overrides: Partial<SettingsLanguageModel> = {}): SettingsLanguageModel {
  return {
    selected: null,
    systemLanguage: 'en',
    onSelect: jest.fn(),
    onBack: jest.fn(),
    isReducedMotion: false,
    ...overrides,
  };
}

describe('SettingsLanguageView', () => {
  it('draws every S11a element with its design testID', async () => {
    await renderWithShell(<SettingsLanguageView model={modelWith()} />);

    const rows = ['system', 'en', 'de', 'fa', 'ckb'].flatMap((key) => [
      `settings-language.language-row.${key}`,
      `settings-language.language-row.${key}.label`,
      `settings-language.language-row.${key}.radio`,
    ]);
    for (const testID of [
      'settings-language.screen',
      'settings-language.top-bar.title',
      'settings-language.list',
      'settings-language.language-row.system.description',
      'settings-language.direction-note',
      'settings-language.direction-note.icon',
      'settings-language.direction-note.label',
      ...rows,
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByTestId('settings-language.language-row.system')).toBeSelected();

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('chooses a language, or System again', async () => {
    const model = modelWith({ selected: 'de' });
    const user = userEvent.setup();
    await renderWithShell(<SettingsLanguageView model={model} />);

    await user.press(screen.getByTestId('settings-language.language-row.fa'));
    await user.press(screen.getByTestId('settings-language.language-row.system'));

    expect(model.onSelect).toHaveBeenNthCalledWith(1, 'fa');
    expect(model.onSelect).toHaveBeenNthCalledWith(2, null);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
