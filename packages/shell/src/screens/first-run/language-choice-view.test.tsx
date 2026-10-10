// packages/shell/src/screens/first-run/language-choice-view.test.tsx
import { screen, userEvent, within } from '@testing-library/react-native';

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

// Spec S2 and 7.2: the four languages, each written in its own script, and one big Continue
// button in the selected language.
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

  it('voices Continue in the language being chosen on an English screen', async () => {
    await renderWithShell(
      <LanguageChoiceView model={modelWith({ selected: 'fa', tSelected: () => 'ادامه' })} />,
    );

    // The font that follows labelLanguage is pinned in button.test.tsx; here the view passes it.
    expect(screen.getByRole('button', { name: 'ادامه' })).toHaveProp('accessibilityLanguage', 'fa');
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("puts the Phone language sticker inside the phone's own row only", async () => {
    await renderWithShell(<LanguageChoiceView model={modelWith({ phoneLanguage: 'de' })} />);

    const germanRow = screen.getByTestId('language-choice.language-row.de');
    expect(
      within(germanRow).getByTestId('language-choice.phone-badge', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getAllByTestId('language-choice.phone-badge', { includeHiddenElements: true }),
    ).toHaveLength(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows no Phone language sticker when the phone speaks none of the four', async () => {
    await renderWithShell(<LanguageChoiceView model={modelWith({ phoneLanguage: null })} />);

    expect(
      screen.queryByTestId('language-choice.phone-badge', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('writes the screen in Persian and keeps every language name as written', async () => {
    await renderWithShell(<LanguageChoiceView model={modelWith({ phoneLanguage: 'fa' })} />, {
      language: 'fa',
    });

    expect(screen.getByRole('header', { name: 'زبان خود را انتخاب کنید' })).toBeOnTheScreen();
    expect(
      screen.getByText('هر وقت خواستید می‌توانید آن را در تنظیمات عوض کنید.'),
    ).toBeOnTheScreen();
    for (const name of ['English', 'Deutsch', 'فارسی', 'کوردیی ناوەندی'])
      expect(screen.getByRole('radio', { name })).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
