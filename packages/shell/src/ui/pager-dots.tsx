// packages/shell/src/ui/pager-dots.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const DOTS = COMPONENT_SPECS.pagerDots;

export type PagerDotsProps = {
  readonly count: number;
  /** 0-based current step. */
  readonly index: number;
  /** `how-to.pager`: dots `.1`..`.n`. */
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    dots: { flexDirection: 'row', alignItems: 'center', gap: DOTS.gap },
    dot: {
      width: DOTS.size,
      height: DOTS.size,
      borderRadius: DOTS.radius,
      borderWidth: DOTS.border,
      borderColor: theme.colors.border,
    },
    current: { width: DOTS.activeWidth, backgroundColor: theme.colors.primary },
  });
  return styles;
});

/** Step dots: 12 pt squares, the current one 30 wide in accent. Decorative (the step chip speaks). */
export function PagerDots({ count, index, testID }: PagerDotsProps): ReactNode {
  const styles = useStyles();
  return (
    <View
      style={styles.dots}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {Array.from({ length: count }, (_, step) => (
        <View
          key={`step-${String(step)}`}
          style={[styles.dot, step === index ? styles.current : null]}
          testID={`${testID}.${String(step + 1)}`}
        />
      ))}
    </View>
  );
}
