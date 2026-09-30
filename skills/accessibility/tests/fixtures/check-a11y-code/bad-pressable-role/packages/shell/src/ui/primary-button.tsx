// packages/shell/src/ui/primary-button.tsx
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { MIN_TOUCH, RADII, SPACING } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';

import type { ReactNode } from 'react';

export type PrimaryButtonProps = {
  /** Already translated. Also the accessibility label. */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  /** Translated hint, only when the result of the tap is not obvious from the label. */
  readonly hint?: string;
  readonly isDisabled?: boolean;
  readonly isBusy?: boolean;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    base: {
      minHeight: MIN_TOUCH,
      minWidth: MIN_TOUCH,
      paddingInline: SPACING.xl,
      paddingBlock: SPACING.md,
      borderRadius: RADII.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.8 },
    inactive: { opacity: 0.5 },
  });
  return styles;
});

export function PrimaryButton(props: PrimaryButtonProps): ReactNode {
  const { label, onPress, testID, isDisabled = false, isBusy = false } = props;
  const styles = useStyles();
  const theme = useTheme();
  const isInactive = isDisabled || isBusy;
  return (
    <Pressable
      accessibilityLabel={label}
      {...(props.hint === undefined ? {} : { accessibilityHint: props.hint })}
      accessibilityState={{ disabled: isInactive, busy: isBusy }}
      disabled={isInactive}
      onPress={onPress}
      style={(state) => [
        styles.base,
        state.pressed && styles.pressed,
        isInactive && styles.inactive,
      ]}
      testID={testID}
    >
      {isBusy ? (
        <ActivityIndicator color={theme.colors.onPrimary} />
      ) : (
        <AppText text={label} variant="label" tone="onPrimary" align="center" />
      )}
    </Pressable>
  );
}
