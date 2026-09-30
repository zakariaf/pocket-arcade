// packages/shell/src/ui/toggle-key.tsx
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RaisedSurface } from './raised-surface.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

const KEY = COMPONENT_SPECS.toggleKey;

export type ToggleKeyProps = {
  readonly icon: IconName;
  /** Translated name: "Sound", "Music", "Vibration". */
  readonly label: string;
  /** Translated state word: "On" or "Off". */
  readonly stateLabel: string;
  readonly isOn: boolean;
  readonly onToggle: () => void;
  readonly testID: string;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  face: {
    minHeight: KEY.minHeight,
    paddingBlock: KEY.paddingBlock,
    paddingInline: KEY.paddingInline,
    gap: KEY.gap,
  },
  state: { flexDirection: 'row', alignItems: 'center', gap: KEY.gap },
  cell: { flex: 1 },
});

/** A Pause-dialog key that switches sound, music or vibration; "on" sits pushed in, in accent. */
export function ToggleKey(props: ToggleKeyProps): ReactNode {
  const theme = useTheme();
  const ink = props.isOn ? theme.colors.onPrimary : theme.colors.icon;
  const tone = props.isOn ? 'onPrimary' : 'default';
  return (
    <RaisedSurface
      label={props.label}
      onPress={props.onToggle}
      testID={props.testID}
      accessibilityRole="switch"
      isChecked={props.isOn}
      isPushedIn={props.isOn}
      elevation={KEY.elevation}
      radius={KEY.radius}
      edgeWidth={KEY.border}
      fill={props.isOn ? theme.colors.primary : theme.colors.surface}
      isReducedMotion={props.isReducedMotion}
      faceStyle={styles.face}
      layoutStyle={styles.cell}
    >
      <Icon name={props.icon} color={ink} size={KEY.icon} testID={`${props.testID}.icon`} />
      <AppText
        text={props.label}
        variant="toggleKeyLabel"
        tone={tone}
        align="center"
        testID={`${props.testID}.label`}
      />
      <View style={styles.state}>
        <Icon name={props.isOn ? 'check' : 'dash'} color={ink} size={KEY.stateIcon} />
        <AppText
          text={props.stateLabel}
          variant="toggleKeyState"
          tone={tone}
          testID={`${props.testID}.state`}
        />
      </View>
    </RaisedSurface>
  );
}
