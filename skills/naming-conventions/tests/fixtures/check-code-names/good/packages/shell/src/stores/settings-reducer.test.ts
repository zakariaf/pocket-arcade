// packages/shell/src/stores/settings-reducer.test.ts
import { settingsReducer } from './settings-reducer.ts';

describe('settingsReducer', () => {
  describe('when the theme changes', () => {
    it('stores the new theme', () => {
      const next = settingsReducer({ theme: 'system', isSoundOn: true }, { type: 'set-theme', theme: 'dark' });
      expect(next.theme).toBe('dark');
    });
  });

  it('can toggle the sound', () => {
    expect(settingsReducer({ theme: 'dark', isSoundOn: true }, { type: 'toggle-sound' }).isSoundOn).toBe(false);
  });
});
