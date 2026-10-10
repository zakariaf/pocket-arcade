// packages/shell/src/screens/settings/settings-rows.test.ts
import { SETTINGS_ROW_TEST_IDS, settingsGroupsFor } from './settings-rows.ts';

import type { SettingsContext, SettingsGroupId, SettingsRowId } from './settings-rows.ts';

const FULL: SettingsContext = {
  hasMusic: true,
  canVibrate: true,
  isPrivacyOptionsRequired: true,
  isPremium: false,
};

function rowsIn(context: SettingsContext, group: SettingsGroupId): readonly SettingsRowId[] {
  return settingsGroupsFor(context).find((candidate) => candidate.id === group)?.rows ?? [];
}

describe('settingsGroupsFor', () => {
  it('lists the seven groups in S11 order', () => {
    expect(settingsGroupsFor(FULL).map((group) => group.testID)).toStrictEqual([
      'settings.group.language',
      'settings.group.sound',
      'settings.group.display',
      'settings.group.premium',
      'settings.group.privacy',
      'settings.group.data',
      'settings.group.about',
    ]);
  });

  it('shows every row the design draws when everything applies', () => {
    const rows = settingsGroupsFor(FULL).flatMap((group) => group.rows);
    expect(rows).toHaveLength(21);
    expect(rows).not.toContain('premium-active');
  });

  it('hides Music and its volume when the game has no music', () => {
    expect(rowsIn({ ...FULL, hasMusic: false }, 'sound')).toStrictEqual([
      'sound-effects',
      'sound-volume',
      'vibration',
    ]);
  });

  it('hides Vibration on devices without haptics', () => {
    expect(rowsIn({ ...FULL, canVibrate: false }, 'sound')).not.toContain('vibration');
  });

  it('shows Ad privacy choices only where privacy options are required', () => {
    expect(rowsIn({ ...FULL, isPrivacyOptionsRequired: false }, 'privacy')).toStrictEqual([
      'privacy-policy',
    ]);
  });

  it('swaps Remove ads for Premium active and keeps Restore for owners', () => {
    expect(rowsIn({ ...FULL, isPremium: true }, 'premium')).toStrictEqual([
      'premium-active',
      'restore-purchase',
    ]);
  });

  it('gives every row a settings.* testID in kebab-case', () => {
    for (const testID of Object.values(SETTINGS_ROW_TEST_IDS)) {
      expect(testID).toMatch(/^settings\.[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});
