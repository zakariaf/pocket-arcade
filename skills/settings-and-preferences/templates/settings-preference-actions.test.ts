// packages/shell/src/screens/settings/settings-preference-actions.test.ts
import { DEFAULT_SETTINGS } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { createPreferenceActions } from './settings-preference-actions.ts';

import type { PreferenceInput } from './settings-preference-actions.ts';
import type { SettingsAction } from '@e07/shell/stores/settings-reducer.ts';

function setup(overrides: Partial<PreferenceInput> = {}): {
  readonly actions: ReturnType<typeof createPreferenceActions>;
  readonly sent: (SettingsAction | 'toggle-feedback')[];
} {
  const sent: (SettingsAction | 'toggle-feedback')[] = [];
  const actions = createPreferenceActions({
    settings: DEFAULT_SETTINGS,
    isReduceMotionOn: false,
    dispatch: (action) => sent.push(action),
    onToggled: () => sent.push('toggle-feedback'),
    ...overrides,
  });
  return { actions, sent };
}

describe('createPreferenceActions', () => {
  it('toggles sound without touching its volume', () => {
    const { actions, sent } = setup();
    actions.onToggleSound();
    expect(sent).toStrictEqual([
      { type: 'set-sound', enabled: false, volume: 80 },
      'toggle-feedback',
    ]);
  });

  it('moves the music volume without switching music on', () => {
    const { actions, sent } = setup();
    actions.onChangeMusicVolume(40);
    expect(sent).toStrictEqual([{ type: 'set-music', enabled: false, volume: 40 }]);
  });

  it('writes the opposite of what the Reduce motion toggle shows', () => {
    const followsPhoneOn = setup({ isReduceMotionOn: true });
    followsPhoneOn.actions.onToggleReduceMotion();
    expect(followsPhoneOn.sent).toStrictEqual([
      { type: 'set-reduce-motion', reduceMotion: 'off' },
      'toggle-feedback',
    ]);
  });

  it('sends one action per display row', () => {
    const { actions, sent } = setup();
    actions.onSelectDigits('local');
    actions.onSelectTheme('dark');
    actions.onToggleColorBlind();
    actions.onToggleHints();
    actions.onToggleVibration();
    expect(sent.map((entry) => (typeof entry === 'string' ? entry : entry.type))).toStrictEqual([
      'set-digits',
      'set-theme',
      'set-color-blind',
      'toggle-feedback',
      'set-hints-during-play',
      'toggle-feedback',
      'set-vibration',
      'toggle-feedback',
    ]);
  });

  it('plays the toggle feedback after a switch, never after a slider move', () => {
    const { actions, sent } = setup();
    actions.onChangeMusicVolume(40);
    actions.onChangeSoundVolume(30);
    expect(sent).not.toContain('toggle-feedback');
    actions.onToggleMusic();
    expect(sent.at(-1)).toBe('toggle-feedback');
  });
});
