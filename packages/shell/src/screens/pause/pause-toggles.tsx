// packages/shell/src/screens/pause/pause-toggles.tsx
import { View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { ToggleKey } from '@e07/shell/ui/toggle-key.tsx';
import { usePairLayout } from '@e07/shell/ui/use-pair-layout.ts';

import type { PauseModel } from './pause-model.ts';
import type { ReactNode } from 'react';

export type PauseTogglesProps = { readonly model: PauseModel };

/** S6 toggle keys in a 3-column grid (gap 10): Sound, Music, Vibration, each "On" or "Off". */
export function PauseToggles({ model }: PauseTogglesProps): ReactNode {
  const t = useT();
  const layout = usePairLayout(10);
  const stateLabel = (isOn: boolean): string => t(isOn ? 'common.on' : 'common.off');
  const { sound, music, vibration, isReducedMotion } = model;
  return (
    <View style={layout.row} testID="pause.toggles">
      <View style={layout.item}>
        <ToggleKey
          testID="pause.sound-switch"
          icon="sound"
          label={t('pause.sound')}
          stateLabel={stateLabel(sound.isOn)}
          isOn={sound.isOn}
          onToggle={sound.onToggle}
          isReducedMotion={isReducedMotion}
        />
      </View>
      {music === null ? null : (
        <View style={layout.item}>
          <ToggleKey
            testID="pause.music-switch"
            icon="music"
            label={t('pause.music')}
            stateLabel={stateLabel(music.isOn)}
            isOn={music.isOn}
            onToggle={music.onToggle}
            isReducedMotion={isReducedMotion}
          />
        </View>
      )}
      {vibration === null ? null : (
        <View style={layout.item}>
          <ToggleKey
            testID="pause.vibration-switch"
            icon="vibration"
            label={t('pause.vibration')}
            stateLabel={stateLabel(vibration.isOn)}
            isOn={vibration.isOn}
            onToggle={vibration.onToggle}
            isReducedMotion={isReducedMotion}
          />
        </View>
      )}
    </View>
  );
}
