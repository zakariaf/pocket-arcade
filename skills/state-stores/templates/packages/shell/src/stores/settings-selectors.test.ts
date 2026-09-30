// packages/shell/src/stores/settings-selectors.test.ts
import {
  selectDigits,
  selectDispatch,
  selectHintsDuringPlay,
  selectIsColorBlind,
  selectIsFirstRun,
  selectIsVibrationOn,
  selectLanguage,
  selectNeedsLanguageChoice,
  selectReduceMotionPreference,
  selectSettings,
  selectThemePreference,
} from '@e07/shell/stores/settings-selectors.ts';
import { createSettingsStore } from '@e07/shell/stores/settings-store.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

function settingsStore() {
  return createSettingsStore(createTestSave().save);
}

describe('settings selectors', () => {
  it('reads the first-launch values straight from the state', () => {
    const state = settingsStore().getState();
    expect(selectLanguage(state)).toBeNull();
    expect(selectDigits(state)).toBe('automatic');
    expect(selectThemePreference(state)).toBe('system');
    expect(selectIsColorBlind(state)).toBe(false);
    expect(selectReduceMotionPreference(state)).toBe('system');
    expect(selectIsVibrationOn(state)).toBe(true);
    expect(selectHintsDuringPlay(state)).toBe(true);
    expect(selectIsFirstRun(state)).toBe(true);
    expect(selectNeedsLanguageChoice(state)).toBe(true);
  });

  it('returns references that already live in the state (no useShallow needed)', () => {
    const state = settingsStore().getState();
    expect(selectSettings(state)).toBe(state.settings);
    expect(selectDispatch(state)).toBe(state.dispatch);
  });

  it('follows a dispatched change', () => {
    const store = settingsStore();
    store.getState().dispatch({ type: 'set-language', language: 'fa' });
    const state = store.getState();
    expect(selectLanguage(state)).toBe('fa');
    expect(selectNeedsLanguageChoice(state)).toBe(false);
  });

  it('reads the first-run milestones as the questions the Shell asks', () => {
    const store = settingsStore();
    store.getState().dispatch({ type: 'finish-tutorial' });
    expect(selectIsFirstRun(store.getState())).toBe(false);
  });
});
