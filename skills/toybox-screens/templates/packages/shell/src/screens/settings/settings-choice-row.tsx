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
  readonly isReducedMotion: boolean;
};

/**
 * Numbers: Automatic / Latin / Local, each with a live preview of 123 in that digit style.
 * SegmentedControl derives settings.numbers-segment.<value> (.label, .preview) from its base.
 */
function digitSegments(model: SettingsModel, t: TFunction): Segment<DigitStyle>[] {
  const previews = model.digitPreviews;
  return [
    {
      value: 'automatic',
      label: t('settings.numbers.automatic'),
      preview: previews.automatic,
    },
    {
      value: 'latin',
      label: t('settings.numbers.latin'),
      preview: previews.latin,
    },
    {
      value: 'local',
      label: t('settings.numbers.local'),
      preview: previews.local,
    },
  ];
}

/** Theme: System / Light / Dark. */
function themeSegments(t: TFunction): Segment<ThemePreference>[] {
  return [
    { value: 'system', label: t('settings.theme.system') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ];
}

/** S11 wrap row: icon and label on top, the segmented control on a full-width line under them. */
export function SettingsChoiceRow(props: SettingsChoiceRowProps): ReactNode {
  const { choice, model, isFirst, isReducedMotion } = props;
  const t = useT();
  const spec = SETTINGS_ROW_SPECS[choice];
  const label = t(spec.labelKey);
  const control =
    choice === 'numbers' ? (
      <SegmentedControl
        testID="settings.numbers-control"
        segmentTestIDBase="settings.numbers-segment"
        label={label}
        segments={digitSegments(model, t)}
        selected={model.settings.digits}
        onSelect={model.actions.onSelectDigits}
        isReducedMotion={isReducedMotion}
        isInRow
      />
    ) : (
      <SegmentedControl
        testID="settings.theme-control"
        segmentTestIDBase="settings.theme-segment"
        label={label}
        segments={themeSegments(t)}
        selected={model.settings.theme}
        onSelect={model.actions.onSelectTheme}
        isReducedMotion={isReducedMotion}
        isInRow
      />
    );
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
