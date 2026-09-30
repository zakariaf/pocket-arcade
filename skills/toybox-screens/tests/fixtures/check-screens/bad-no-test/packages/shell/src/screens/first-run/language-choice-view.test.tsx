// packages/shell/src/screens/first-run/language-choice-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { LanguageChoiceView } from './language-choice-view.tsx';

import type { LanguageChoiceModel } from './language-choice-view.tsx';

const TEST_IDS = [
  'language-choice.screen',
  'language-choice.art',
  'language-choice.title',
  'language-choice.subtitle',
  'language-choice.language-row.en',
  'language-choice.language-row.de',
  'language-choice.language-row.fa',
  'language-choice.language-row.ckb',
  'language-choice.phone-badge',
  'language-choice.continue-button',
];

function modelWith(overrides: Partial<LanguageChoiceModel> = {}): LanguageChoiceModel {
  return {
    selected: 'en',
    phoneLanguage: 'en',
    tSelected: () => 'Weiter',
    isReducedMotion: false,
    onSelect: jest.fn(),
    onContinue: jest.fn(),
    ...overrides,
  };
}

describe('LanguageChoiceView', () => {
  it('draws every S2 element with its design testID', async () => {
    await renderWithShell(<LanguageChoiceView model={modelWith()} />);

    for (const testID of TEST_IDS)
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'English' })).toBeSelected();

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows Continue in the selected language and reports choices', async () => {
    const model = modelWith({ selected: 'de' });
    const user = userEvent.setup();
    await renderWithShell(<LanguageChoiceView model={model} />);

    await user.press(screen.getByRole('radio', { name: 'فارسی' }));
    await user.press(screen.getByRole('button', { name: 'Weiter' }));

    expect(model.onSelect).toHaveBeenCalledWith('fa');
    expect(model.onContinue).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
