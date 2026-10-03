// packages/shell/src/ui/week-mark.tsx
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { ReactNode } from 'react';

const WEEK = COMPONENT_SPECS.weekStrip;

/** done: accent + check · missed: dashed inkSoft + close · today (not played yet): dashed outline + play. */
export type WeekMarkState = 'done' | 'missed' | 'today';

export type WeekMarkProps = {
  readonly state: WeekMarkState;
  /** regular 38 pt in the strip; xs 22 pt in the legend. */
  readonly size: 'regular' | 'xs';
  /** Strip marks: the day's own label ("Monday, done", "Today"); legend marks have none. */
  readonly label?: string;
  readonly testID?: string;
};

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  regular: {
    width: WEEK.mark,
    height: WEEK.mark,
    borderRadius: WEEK.markRadius,
    borderWidth: WEEK.markBorder,
  },
  xs: {
    width: WEEK.markXs,
    height: WEEK.markXs,
    borderRadius: WEEK.markXsRadius,
    borderWidth: WEEK.markXsBorder,
  },
  dashed: { borderStyle: 'dashed' },
});

type MarkPaint = {
  readonly fill: string | undefined;
  readonly edge: string;
  readonly ink: string;
  readonly icon: IconName;
};

function paintOf(theme: Theme, state: WeekMarkState): MarkPaint {
  const { colors } = theme;
  switch (state) {
    case 'done':
      return { fill: colors.primary, edge: colors.border, ink: colors.onPrimary, icon: 'check' };
    case 'missed':
      return { fill: undefined, edge: colors.textMuted, ink: colors.textMuted, icon: 'close' };
    case 'today':
      return { fill: colors.surface, edge: colors.border, ink: colors.text, icon: 'play' };
  }
}

/** One day's mark in the S9 week strip (a labelled image) or its legend (decorative). */
export function WeekMark({ state, size, label, testID }: WeekMarkProps): ReactNode {
  const theme = useTheme();
  const paint = paintOf(theme, state);
  return (
    <View
      style={[
        styles.mark,
        size === 'xs' ? styles.xs : styles.regular,
        state === 'done' ? null : styles.dashed,
        { borderColor: paint.edge },
        paint.fill === undefined ? null : { backgroundColor: paint.fill },
      ]}
      {...(label === undefined
        ? {
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants' as const,
          }
        : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label })}
      testID={testID}
    >
      <Icon
        name={paint.icon}
        color={paint.ink}
        size={size === 'xs' ? WEEK.markXsIcon : WEEK.markIcon}
      />
    </View>
  );
}
