// packages/shell/src/screens/settings/settings-row-bindings.ts
// Pure: what each S11 row shows (value, on/off) and does (press, toggle).
import type { SettingsExtras } from './settings-extras.ts';
import type { SettingsRowId } from './settings-rows.ts';
import type { SettingsModel } from './use-settings-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';

export type SettingsRowBinding = {
  /** Replaces the spec's label (Remove ads with the store price). */
  readonly label?: string;
  readonly value?: string;
  readonly isOn?: boolean;
  readonly onToggle?: () => void;
  readonly onPress?: () => void;
};

export type BindingInput = {
  readonly model: SettingsModel;
  readonly extras: SettingsExtras;
  readonly t: TFunction;
};

function toggle(isOn: boolean, onToggle: () => void): SettingsRowBinding {
  return { isOn, onToggle };
}

function removeAds({ extras, t }: BindingInput): SettingsRowBinding {
  return {
    ...(extras.removeAdsPriceText === null
      ? {}
      : { label: t('settings.premium.remove-ads', { priceText: extras.removeAdsPriceText }) }),
    onPress: extras.onOpenPremium,
  };
}

/** The chevron rows that only open something: the SettingsExtras handler each one calls. */
const LINK_TARGETS = {
  'restore-purchase': 'onRestorePurchase',
  'ad-privacy': 'onOpenAdPrivacy',
  'privacy-policy': 'onOpenPrivacyPolicy',
  'reset-stats': 'onResetStats',
  'reset-progress': 'onResetProgress',
  about: 'onOpenAbout',
  licences: 'onOpenLicences',
  rate: 'onRate',
  contact: 'onContact',
} as const;

/** What each row shows and does. Segmented, volume and Premium-active rows bind in their own components. */
export function bindSettingsRow(id: SettingsRowId, input: BindingInput): SettingsRowBinding {
  const { model, extras } = input;
  const { settings, actions } = model;
  switch (id) {
    case 'language':
      return { value: model.languageValue, onPress: extras.onOpenLanguage };
    case 'sound-effects':
      return toggle(settings.soundEnabled, actions.onToggleSound);
    case 'music':
      return toggle(settings.musicEnabled, actions.onToggleMusic);
    case 'vibration':
      return toggle(settings.vibrationEnabled, actions.onToggleVibration);
    case 'colour-blind':
      return toggle(settings.colorBlind, actions.onToggleColorBlind);
    case 'reduce-motion':
      return toggle(model.isReduceMotionOn, actions.onToggleReduceMotion);
    case 'hints':
      return toggle(settings.hintsDuringPlay, actions.onToggleHints);
    case 'remove-ads':
      return removeAds(input);
    case 'restore-purchase':
    case 'ad-privacy':
    case 'privacy-policy':
    case 'reset-stats':
    case 'reset-progress':
    case 'about':
    case 'licences':
    case 'rate':
    case 'contact':
      return { onPress: extras[LINK_TARGETS[id]] };
    case 'numbers':
    case 'theme':
    case 'sound-volume':
    case 'music-volume':
    case 'premium-active':
      return {};
  }
}
