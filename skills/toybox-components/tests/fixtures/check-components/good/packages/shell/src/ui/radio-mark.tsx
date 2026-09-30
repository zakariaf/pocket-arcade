// packages/shell/src/ui/radio-mark.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';

import type { ReactNode } from 'react';

const RADIO = COMPONENT_SPECS.radio;

export type RadioMarkProps = {
  readonly isSelected: boolean;
  /** Part id, usually `<row or card>.radio`. */
  readonly testID?: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    mark: {
      width: RADIO.size,
      height: RADIO.size,
      borderRadius: RADIO.radius,
      borderWidth: RADIO.border,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  return styles;
});

/** A square radio mark: empty, or a check when chosen. The row or card around it is the radio. */
export function RadioMark({ isSelected, testID }: RadioMarkProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View
      style={styles.mark}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
    >
      {isSelected ? <Icon name="check" color={theme.colors.icon} size={RADIO.icon} /> : null}
    </View>
  );
}
