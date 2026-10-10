// packages/shell/src/screens/settings/settings-volume-row.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { Slider } from '@e07/shell/ui/slider.tsx';
import { SubRow } from '@e07/shell/ui/sub-row.tsx';

import { SETTINGS_ROW_TEST_IDS } from './settings-rows.ts';

import type { SettingsModel } from './use-settings-model.ts';
import type { ReactNode } from 'react';

export type SettingsVolumeRowProps = {
  readonly channel: 'sound-volume' | 'music-volume';
  readonly model: SettingsModel;
};

const SLIDER_TEST_IDS = {
  'sound-volume': 'settings.sound-volume-slider',
  'music-volume': 'settings.music-volume-slider',
} as const;

/** The save keeps integer percent; the Toybox Slider works in 0..1. */
const PERCENT = 100;

/**
 * S11 volume sub-row under Sound effects or Music: no separator, start padding 64, "Volume"
 * (14 muted) and a slider; the fill turns muted while the sound is off. The Slider reports every
 * drag step as 0..1: the row turns it into integer percent and dispatches only when the percent
 * changes, so a drag writes the save at most once per percent (a write is well under 1 ms).
 */
export function SettingsVolumeRow({ channel, model }: SettingsVolumeRowProps): ReactNode {
  const t = useT();
  const { settings, actions } = model;
  const isSound = channel === 'sound-volume';
  const volume = isSound ? settings.soundVolume : settings.musicVolume;
  const onVolume = isSound ? actions.onChangeSoundVolume : actions.onChangeMusicVolume;
  const label = t('settings.volume.label');
  const handleChange = (ratio: number): void => {
    const percent = Math.round(ratio * PERCENT);
    if (percent !== volume) onVolume(percent);
  };
  return (
    <SubRow testID={SETTINGS_ROW_TEST_IDS[channel]} label={label}>
      <Slider
        testID={SLIDER_TEST_IDS[channel]}
        label={label}
        value={volume / PERCENT}
        isOff={isSound ? !settings.soundEnabled : !settings.musicEnabled}
        onChange={handleChange}
      />
    </SubRow>
  );
}
