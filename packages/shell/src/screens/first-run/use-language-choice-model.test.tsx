// packages/shell/src/screens/first-run/use-language-choice-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';

import { restartForDirection } from '@e07/shell/i18n/direction.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { phoneLanguageOf, useLanguageChoiceModel } from './use-language-choice-model.ts';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));
jest.mock('@e07/shell/i18n/direction.ts', () => ({
  readLayoutDirection: () => 'ltr',
  restartForDirection: jest.fn(() => Promise.resolve()),
}));
jest.mock('@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts', () => ({
  createSqliteKvDirectionGuardAdapter: () => ({ readPending: () => null, writePending: jest.fn() }),
}));

const GERMAN_PHONE = [{ languageCode: 'de', languageScriptCode: null }];

async function languageChoice(locales: readonly object[]) {
  jest.mocked(getLocales).mockReturnValue(locales as ReturnType<typeof getLocales>);
  const shell = createShellWrapper({
    services: { audio: createFakeAudio(), errorLog: createFakeErrorLog() },
  });
  const view = await renderHook(() => useLanguageChoiceModel(), { wrapper: shell.wrapper });
  return { ...view, stores: shell.stores };
}

// Spec S2 and 7.2: the phone's language is pre-selected when it is one of the four; otherwise
// English. Any Persian tag (Dari included) counts as fa, any Sorani tag as ckb; Kurmanji falls back.
describe('useLanguageChoiceModel', () => {
  it("preselects the phone's language and says Continue in the language being chosen", async () => {
    const { result } = await languageChoice(GERMAN_PHONE);
    expect([result.current.selected, result.current.phoneLanguage]).toStrictEqual(['de', 'de']);
    expect(result.current.tSelected('language-choice.continue-button')).toBe('Weiter');

    await act(() => {
      result.current.onSelect('en');
    });
    expect(result.current.tSelected('language-choice.continue-button')).toBe('Continue');
  });

  it('falls back to English when the phone speaks none of the four', async () => {
    const { result } = await languageChoice([{ languageCode: 'ja', languageScriptCode: null }]);
    expect([result.current.selected, result.current.phoneLanguage]).toStrictEqual(['en', null]);
  });

  it('saves the choice on Continue and restarts only when the direction flips', async () => {
    const { result, stores } = await languageChoice(GERMAN_PHONE);
    await act(() => {
      result.current.onContinue();
    });
    expect(stores.settings.getState().settings.language).toBe('de');
    expect(stores.settings.getState().firstRun.languageChosen).toBe(true);
    expect(jest.mocked(restartForDirection)).not.toHaveBeenCalled();

    await act(() => {
      result.current.onSelect('fa');
    });
    await act(async () => {
      result.current.onContinue();
      await Promise.resolve();
    });
    expect(jest.mocked(restartForDirection)).toHaveBeenCalledWith('rtl', expect.anything());
  });

  it.each([
    ['fa-IR', { languageCode: 'fa', languageScriptCode: null }, 'fa'],
    ['ckb-IQ', { languageCode: 'ckb', languageScriptCode: null }, 'ckb'],
    ['de-DE', { languageCode: 'de', languageScriptCode: null }, 'de'],
    ['prs-AF', { languageCode: 'prs', languageScriptCode: null }, 'fa'],
  ] as const)('preselects the phone locale %s (spec 7.2)', async (_tag, locale, language) => {
    const { result } = await languageChoice([locale]);
    expect([result.current.selected, result.current.phoneLanguage]).toStrictEqual([
      language,
      language,
    ]);
  });

  it.each([
    ['ku-TR (Kurmanji, Latin script)', { languageCode: 'ku', languageScriptCode: 'Latn' }],
    ['ku with no script', { languageCode: 'ku', languageScriptCode: null }],
  ] as const)('selects English with no phone language for %s (spec 7.2)', async (_tag, locale) => {
    const { result } = await languageChoice([locale]);
    expect([result.current.selected, result.current.phoneLanguage]).toStrictEqual(['en', null]);
  });

  it('takes the first language the app speaks from the phone list', async () => {
    const { result } = await languageChoice([
      { languageCode: 'ja', languageScriptCode: null },
      { languageCode: 'fa', languageScriptCode: null },
    ]);
    expect([result.current.selected, result.current.phoneLanguage]).toStrictEqual(['fa', 'fa']);
  });

  it('writes a Persian choice to the save before it asks for the restart', async () => {
    const { result, stores } = await languageChoice([
      { languageCode: 'en', languageScriptCode: null },
    ]);
    const languageAtRestart: (string | null)[] = [];
    jest.mocked(restartForDirection).mockImplementationOnce(() => {
      languageAtRestart.push(stores.settings.getState().settings.language);
      return Promise.resolve();
    });

    await act(() => {
      result.current.onSelect('fa');
    });
    await act(async () => {
      result.current.onContinue();
      await Promise.resolve();
    });
    expect(languageAtRestart).toStrictEqual(['fa']);
  });

  it('reads Sorani from a Kurdish locale written in Arabic script', () => {
    expect(phoneLanguageOf([{ languageCode: 'ku', languageScriptCode: 'Arab' }])).toBe('ckb');
  });
});
