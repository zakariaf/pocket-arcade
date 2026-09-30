// packages/shell/src/stores/settings-reducer.test.ts
// Test naming: describe('<exported name>') → describe('when …') → it('<third-person verb> …').
import { DEFAULT_SETTINGS, settingsReducer } from './settings-reducer.ts';

describe('settingsReducer', () => {
  describe('when the theme is set', () => {
    it('stores the new theme', () => {
      const next = settingsReducer(DEFAULT_SETTINGS, { type: 'set-theme', theme: 'dark' });

      expect(next.theme).toBe('dark');
    });

    it('keeps the sound setting', () => {
      const next = settingsReducer(DEFAULT_SETTINGS, { type: 'set-theme', theme: 'light' });

      expect(next.isSoundOn).toBe(true);
    });
  });

  it('can toggle the sound off and on', () => {
    const off = settingsReducer(DEFAULT_SETTINGS, { type: 'toggle-sound' });

    expect(settingsReducer(off, { type: 'toggle-sound' })).toStrictEqual(DEFAULT_SETTINGS);
  });
});
