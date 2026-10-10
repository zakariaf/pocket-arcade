// packages/shell/src/screens/settings/sound-group.tsx
import { ListGroup } from '@e07/shell/ui/list-group.tsx';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { Slider } from '@e07/shell/ui/slider.tsx';
import { SubRow } from '@e07/shell/ui/sub-row.tsx';

import type { SoundActions } from './settings-preference-actions.ts';
import type { ReactNode } from 'react';

/** Everything is already translated or derived by the screen model (use-settings-model.ts). */
export type SoundGroupView = {
  readonly title: string;
  readonly soundLabel: string;
  readonly volumeLabel: string;
  readonly vibrationLabel: string;
  readonly isSoundOn: boolean;
  /** Integer percent 0..100, as the save keeps it. */
  readonly soundVolume: number;
  readonly isVibrationOn: boolean;
};

/** The screen model's own handlers: onChangeSoundVolume takes integer percent. */
export type SoundGroupActions = Pick<
  SoundActions,
  'onToggleSound' | 'onChangeSoundVolume' | 'onToggleVibration'
>;

export type SoundGroupProps = {
  readonly view: SoundGroupView;
  readonly actions: SoundGroupActions;
  readonly isReducedMotion: boolean;
};

/** The save keeps integer percent; the Toybox Slider works in 0..1. */
const PERCENT = 100;

/**
 * S11 "Sound and feel": a folder tab over a flat list of switch rows and a volume sub-row. The
 * Slider reports 0..1; the group turns it into percent and dispatches only when the percent
 * changes (as SettingsVolumeRow does).
 */
export function SoundGroup({ view, actions, isReducedMotion }: SoundGroupProps): ReactNode {
  const handleVolume = (ratio: number): void => {
    const percent = Math.round(ratio * PERCENT);
    if (percent !== view.soundVolume) actions.onChangeSoundVolume(percent);
  };
  return (
    <ListGroup title={view.title} icon="sound" testID="settings.group.sound">
      <ListRow
        label={view.soundLabel}
        icon="sound"
        end="toggle"
        isOn={view.isSoundOn}
        onPress={actions.onToggleSound}
        testID="settings.sound-effects-switch"
        isReducedMotion={isReducedMotion}
        isFirst
      />
      <SubRow label={view.volumeLabel} testID="settings.sound-volume-row">
        <Slider
          value={view.soundVolume / PERCENT}
          onChange={handleVolume}
          label={view.volumeLabel}
          testID="settings.sound-volume-slider"
          isOff={!view.isSoundOn}
        />
      </SubRow>
      <ListRow
        label={view.vibrationLabel}
        icon="vibration"
        end="toggle"
        isOn={view.isVibrationOn}
        onPress={actions.onToggleVibration}
        testID="settings.vibration-switch"
        isReducedMotion={isReducedMotion}
      />
    </ListGroup>
  );
}
