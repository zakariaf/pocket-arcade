// packages/shell/src/screens/settings/settings-rows.ts
// Pure: which S11 groups and rows show, in which order, with which testID. The Settings
// screen renders exactly this list, so every visibility rule is unit-tested here.

export const SETTINGS_GROUP_IDS = [
  'language',
  'sound',
  'display',
  'premium',
  'privacy',
  'data',
  'about',
] as const;
export type SettingsGroupId = (typeof SETTINGS_GROUP_IDS)[number];

export const SETTINGS_ROW_TEST_IDS = {
  language: 'settings.language-row',
  numbers: 'settings.numbers-row',
  'sound-effects': 'settings.sound-effects-switch',
  'sound-volume': 'settings.sound-volume-row',
  music: 'settings.music-switch',
  'music-volume': 'settings.music-volume-row',
  vibration: 'settings.vibration-switch',
  theme: 'settings.theme-row',
  'colour-blind': 'settings.colour-blind-switch',
  'reduce-motion': 'settings.reduce-motion-switch',
  hints: 'settings.hints-switch',
  'remove-ads': 'settings.remove-ads-row',
  'premium-active': 'settings.premium-active',
  'restore-purchase': 'settings.restore-purchase-row',
  'ad-privacy': 'settings.ad-privacy-row',
  'privacy-policy': 'settings.privacy-policy-row',
  'reset-stats': 'settings.reset-stats-row',
  'reset-progress': 'settings.reset-progress-row',
  about: 'settings.about-row',
  licences: 'settings.licences-row',
  rate: 'settings.rate-row',
  contact: 'settings.contact-row',
} as const;
export type SettingsRowId = keyof typeof SETTINGS_ROW_TEST_IDS;

export type SettingsGroup = {
  readonly id: SettingsGroupId;
  /** The group tab and list: settings.group.<id> (+ .tab and .list, derived by ListGroup). */
  readonly testID: string;
  readonly rows: readonly SettingsRowId[];
};

/** Facts from outside the settings store that decide which rows exist. */
export type SettingsContext = {
  /** The game's sound bank has a sound with category 'music' (most games have none). */
  readonly hasMusic: boolean;
  /** HapticsPort.isSupported: false on iPad, which has no Taptic Engine. */
  readonly canVibrate: boolean;
  /** The last consent answer says privacy options are REQUIRED (ads consent section). */
  readonly isPrivacyOptionsRequired: boolean;
  /** Premium is owned: the group shows "Premium active" instead of "Remove ads". */
  readonly isPremium: boolean;
};

function soundRows(context: SettingsContext): readonly SettingsRowId[] {
  return [
    'sound-effects',
    'sound-volume',
    ...(context.hasMusic ? (['music', 'music-volume'] as const) : []),
    ...(context.canVibrate ? (['vibration'] as const) : []),
  ];
}

function rowsOf(id: SettingsGroupId, context: SettingsContext): readonly SettingsRowId[] {
  switch (id) {
    case 'language':
      return ['language', 'numbers'];
    case 'sound':
      return soundRows(context);
    case 'display':
      return ['theme', 'colour-blind', 'reduce-motion', 'hints'];
    case 'premium':
      return [context.isPremium ? 'premium-active' : 'remove-ads', 'restore-purchase'];
    case 'privacy':
      return context.isPrivacyOptionsRequired
        ? ['ad-privacy', 'privacy-policy']
        : ['privacy-policy'];
    case 'data':
      return ['reset-stats', 'reset-progress'];
    case 'about':
      return ['about', 'licences', 'rate', 'contact'];
  }
}

/** The seven groups in S11 order; rows hidden by the context are left out, never greyed. */
export function settingsGroupsFor(context: SettingsContext): readonly SettingsGroup[] {
  return SETTINGS_GROUP_IDS.map((id) => ({
    id,
    testID: `settings.group.${id}`,
    rows: rowsOf(id, context),
  }));
}
