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

  it('reads Sorani from a Kurdish locale written in Arabic script', () => {
    expect(phoneLanguageOf([{ languageCode: 'ku', languageScriptCode: 'Arab' }])).toBe('ckb');
  });
});
