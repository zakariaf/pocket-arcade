// packages/shell/src/screens/settings/settings-choice-row.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { SegmentedControl } from '@e07/shell/ui/segmented-control.tsx';

import { SETTINGS_ROW_SPECS } from './settings-row-specs.ts';
import { SETTINGS_ROW_TEST_IDS } from './settings-rows.ts';

import type { SettingsModel } from './use-settings-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { DigitStyle } from '@e07/shell/i18n/digits.ts';
import type { ThemePreference } from '@e07/shell/theme/theme-types.ts';
import type { Segment } from '@e07/shell/ui/segmented-control.tsx';
import type { ReactNode } from 'react';

export type SettingsChoiceRowProps = {
  readonly choice: 'numbers' | 'theme';
  readonly model: SettingsModel;
  readonly isFirst: boolean;
};

/** One choice's segmented control: what differs between Numbers and Theme. */
type ChoiceControl<TValue extends string> = {
  readonly testID: string;
  readonly segmentTestIDBase: string;
  readonly segments: readonly Segment<TValue>[];
  readonly selected: TValue;
  readonly onSelect: (value: TValue) => void;
};

/**
 * Numbers: Automatic / Latin / Local, each with a live preview of 123 in that digit style.
 * SegmentedControl derives settings.numbers-segment.<value> (.label, .preview) from its base.
 */
function digitControl(model: SettingsModel, t: TFunction): ChoiceControl<DigitStyle> {
  const previews = model.digitPreviews;
  return {
    testID: 'settings.numbers-control',
    segmentTestIDBase: 'settings.numbers-segment',
    segments: [
      { value: 'automatic', label: t('settings.numbers.automatic'), preview: previews.automatic },
      { value: 'latin', label: t('settings.numbers.latin'), preview: previews.latin },
      { value: 'local', label: t('settings.numbers.local'), preview: previews.local },
    ],
    selected: model.settings.digits,
    onSelect: model.actions.onSelectDigits,
  };
}

/** Theme: System / Light / Dark. */
function themeControl(model: SettingsModel, t: TFunction): ChoiceControl<ThemePreference> {
  return {
    testID: 'settings.theme-control',
    segmentTestIDBase: 'settings.theme-segment',
    segments: [
      { value: 'system', label: t('settings.theme.system') },
      { value: 'light', label: t('settings.theme.light') },
      { value: 'dark', label: t('settings.theme.dark') },
    ],
    selected: model.settings.theme,
    onSelect: model.actions.onSelectTheme,
  };
}

/** The one segmented control of a wrap row, in the row (no frame of its own). */
function renderControl<TValue extends string>(
  control: ChoiceControl<TValue>,
  label: string,
  isReducedMotion: boolean,
): ReactNode {
  return (
    <SegmentedControl
      testID={control.testID}
      segmentTestIDBase={control.segmentTestIDBase}
      label={label}
      segments={control.segments}
      selected={control.selected}
      onSelect={control.onSelect}
      isReducedMotion={isReducedMotion}
      isInRow
    />
  );
}

/** S11 wrap row: icon and label on top, the segmented control on a full-width line under them. */
export function SettingsChoiceRow({ choice, model, isFirst }: SettingsChoiceRowProps): ReactNode {
  const t = useT();
  const spec = SETTINGS_ROW_SPECS[choice];
  const label = t(spec.labelKey);
  const { isReducedMotion } = model;
  const control =
    choice === 'numbers'
      ? renderControl(digitControl(model, t), label, isReducedMotion)
      : renderControl(themeControl(model, t), label, isReducedMotion);
  return (
    <ListRow
      testID={SETTINGS_ROW_TEST_IDS[choice]}
      icon={spec.icon}
      label={label}
      isFirst={isFirst}
      isReducedMotion={isReducedMotion}
      below={control}
    />
  );
}
