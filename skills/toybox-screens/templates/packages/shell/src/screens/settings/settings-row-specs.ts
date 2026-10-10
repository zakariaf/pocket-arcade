// packages/shell/src/screens/settings/settings-row-specs.ts
// Pure: how each S11 row looks (icon tile, copy keys, danger and strong labels) and each group
// tab. Which rows show, in which order, with which testID, lives in settings-rows.ts
// (settings-and-preferences); which component draws a row, in settings-row.tsx (by its id).
import type { SettingsGroupId, SettingsRowId } from './settings-rows.ts';
import type { ShellMessageKey } from '@e07/shell/i18n/messages.ts';
import type { IconTileIcon, IconTilePaint } from '@e07/shell/ui/icon-tile.tsx';
import type { IconName } from '@e07/shell/ui/icons/icon-paths.ts';

export type SettingsRowSpec = {
  readonly icon: IconTileIcon;
  readonly labelKey: ShellMessageKey;
  readonly descriptionKey?: ShellMessageKey;
  readonly iconPaint?: IconTilePaint;
  /** Danger rows: label danger Bold, icon tile dangerFill with a danger edge. */
  readonly isDanger?: boolean;
  /** Bold label in the normal ink (Remove ads with its price). */
  readonly isStrong?: boolean;
};

const DANGER = { icon: 'trash', isDanger: true } as const;

export const SETTINGS_ROW_SPECS: Readonly<Record<SettingsRowId, SettingsRowSpec>> = {
  language: { icon: 'globe', labelKey: 'settings.language.label' },
  numbers: { icon: 'hash', labelKey: 'settings.numbers.label' },
  'sound-effects': { icon: 'sound', labelKey: 'settings.sound-effects.label' },
  'sound-volume': { icon: 'sound', labelKey: 'settings.volume.label' },
  music: { icon: 'music', labelKey: 'settings.music.label' },
  'music-volume': { icon: 'music', labelKey: 'settings.volume.label' },
  vibration: { icon: 'vibration', labelKey: 'settings.vibration.label' },
  theme: { icon: 'theme', labelKey: 'settings.theme.label' },
  'colour-blind': {
    icon: 'eye',
    labelKey: 'settings.colour-blind.label',
    descriptionKey: 'settings.colour-blind.description',
  },
  'reduce-motion': {
    icon: 'motion',
    labelKey: 'settings.reduce-motion.label',
    descriptionKey: 'settings.reduce-motion.description',
  },
  hints: {
    icon: 'hint',
    labelKey: 'settings.hints.label',
    descriptionKey: 'settings.hints.description',
  },
  'remove-ads': {
    icon: 'crown',
    iconPaint: 'gold',
    isStrong: true,
    labelKey: 'settings.premium.remove-ads-no-price',
  },
  'premium-active': { icon: 'crown', labelKey: 'premium.active' },
  'restore-purchase': { icon: 'restore', labelKey: 'common.restore-purchase' },
  'ad-privacy': {
    icon: 'shield',
    labelKey: 'settings.ad-privacy.label',
    descriptionKey: 'settings.ad-privacy.description',
  },
  'privacy-policy': { icon: 'doc', labelKey: 'settings.privacy-policy.label' },
  'reset-stats': { ...DANGER, labelKey: 'settings.reset-stats.label' },
  'reset-progress': {
    ...DANGER,
    labelKey: 'settings.reset-progress.label',
    descriptionKey: 'settings.reset-progress.description',
  },
  about: { icon: 'info', labelKey: 'settings.about.label' },
  licences: { icon: 'doc', labelKey: 'settings.licences.label' },
  // The design's star(false): the hollow rating star with its 1.8 edge, not the 2.5 outline icon.
  rate: { icon: 'rating-star-hollow', labelKey: 'settings.rate.label' },
  contact: { icon: 'mail', labelKey: 'settings.contact.label' },
};

export type SettingsGroupTab = { readonly titleKey: ShellMessageKey; readonly icon: IconName };

export const SETTINGS_GROUP_TABS: Readonly<Record<SettingsGroupId, SettingsGroupTab>> = {
  language: { titleKey: 'settings.group.language', icon: 'globe' },
  sound: { titleKey: 'settings.group.sound', icon: 'sound' },
  display: { titleKey: 'settings.group.display', icon: 'theme' },
  premium: { titleKey: 'settings.group.premium', icon: 'crown' },
  privacy: { titleKey: 'settings.group.privacy', icon: 'shield' },
  data: { titleKey: 'settings.group.data', icon: 'trash' },
  about: { titleKey: 'settings.group.about', icon: 'info' },
};
