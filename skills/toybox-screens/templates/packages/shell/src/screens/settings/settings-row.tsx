// packages/shell/src/screens/settings/settings-row.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { COMPONENT_SPECS } from '@e07/shell/ui/component-specs.ts';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import { SettingsChoiceRow } from './settings-choice-row.tsx';
import { bindSettingsRow } from './settings-row-bindings.ts';
import { SETTINGS_ROW_SPECS } from './settings-row-specs.ts';
import { SETTINGS_ROW_TEST_IDS } from './settings-rows.ts';
import { SettingsVolumeRow } from './settings-volume-row.tsx';

import type { SettingsExtras } from './settings-extras.ts';
import type { SettingsRowBinding } from './settings-row-bindings.ts';
import type { SettingsRowId } from './settings-rows.ts';
import type { SettingsModel } from './use-settings-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { ListRowProps } from '@e07/shell/ui/list-row.tsx';
import type { ReactNode } from 'react';

export type SettingsRowProps = {
  readonly id: SettingsRowId;
  readonly model: SettingsModel;
  readonly extras: SettingsExtras;
  /** The first row of a list has no separator on top. */
  readonly isFirst: boolean;
};

const ROW = COMPONENT_SPECS.row;

const styles = StyleSheet.create({
  // The Premium-owner row has a ListRow's box but holds only the sticker.
  premium: {
    minHeight: ROW.minHeight,
    justifyContent: 'center',
    paddingBlock: ROW.paddingBlock,
    paddingInline: ROW.paddingInline,
  },
});

/** A switch row: the whole row is the switch; the press flips it. */
function endProps(binding: SettingsRowBinding): Partial<ListRowProps> {
  if (binding.onToggle !== undefined) {
    return { end: 'toggle', isOn: binding.isOn === true, onPress: binding.onToggle };
  }
  if (binding.onPress !== undefined) return { end: 'chevron', onPress: binding.onPress };
  return {};
}

type RowInput = {
  readonly id: SettingsRowId;
  readonly binding: SettingsRowBinding;
  readonly t: TFunction;
  readonly isReducedMotion: boolean;
};

/** The ListRow props of a chevron or switch row. */
function listRowProps({ id, binding, t, isReducedMotion }: RowInput): ListRowProps {
  const spec = SETTINGS_ROW_SPECS[id];
  const isDanger = spec.isDanger === true;
  return {
    testID: SETTINGS_ROW_TEST_IDS[id],
    label: binding.label ?? t(spec.labelKey),
    icon: spec.icon,
    iconPaint: isDanger ? 'danger' : (spec.iconPaint ?? 'pop'),
    isDanger,
    ...(spec.isStrong === true ? { isStrong: true } : {}),
    isReducedMotion,
    ...(spec.descriptionKey === undefined ? {} : { description: t(spec.descriptionKey) }),
    ...(binding.value === undefined ? {} : { value: binding.value }),
    ...endProps(binding),
  };
}

/** One S11 row: a chevron or switch row, a volume sub-row, a segmented wrap row, or Premium active. */
export function SettingsRow({ id, model, extras, isFirst }: SettingsRowProps): ReactNode {
  const t = useT();
  const spec = SETTINGS_ROW_SPECS[id];
  if (id === 'numbers' || id === 'theme') {
    return (
      <SettingsChoiceRow
        choice={id}
        model={model}
        isFirst={isFirst}
        isReducedMotion={model.isReducedMotion}
      />
    );
  }
  if (id === 'sound-volume' || id === 'music-volume')
    return <SettingsVolumeRow channel={id} model={model} />;
  if (spec.kind === 'premium-active') {
    return (
      <View style={styles.premium}>
        <Sticker
          testID="settings.premium-active"
          text={t('premium.active')}
          icon="crown"
          tiltDeg={-3}
        />
      </View>
    );
  }
  return (
    <ListRow
      {...listRowProps({
        id,
        binding: bindSettingsRow(id, { model, extras, t }),
        t,
        isReducedMotion: model.isReducedMotion,
      })}
      isFirst={isFirst}
    />
  );
}
