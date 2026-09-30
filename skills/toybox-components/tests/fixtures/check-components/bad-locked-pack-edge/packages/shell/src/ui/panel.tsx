// packages/shell/src/ui/panel.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { SPACING } from '@e07/shell/theme/tokens.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

const PANEL = COMPONENT_SPECS.panel;
const LOCKED_BORDER = COMPONENT_SPECS.offer.border;

/**
 * default: surface, ink edge · locked: dashed ink edge on sunken (a locked pack) ·
 * error: danger edge on dangerFill (the S12 error note).
 */
export type PanelTone = 'default' | 'locked' | 'error';
/** regular 14 x 16 · compact 12 x 14 (streak and stat cards) · daily 14 / 14 / 16. */
export type PanelPadding = 'regular' | 'compact' | 'daily';

export type PanelProps = {
  readonly children: ReactNode;
  readonly testID: string;
  readonly tone?: PanelTone;
  readonly padding?: PanelPadding;
  /** Lay the children out in a row (note panels, the today card). */
  readonly isRow?: boolean;
  /** Gap between children: SPACING.md by default. */
  readonly gap?: number;
};

const useStyles = makeStyles((theme) => {
  const shell = SHELL_COLORS[theme.scheme];
  const styles = StyleSheet.create({
    // Information lies flat: an ink edge and no shadow (only pressable things are raised).
    panel: {
      alignSelf: 'stretch',
      borderWidth: PANEL.border,
      borderColor: theme.colors.border,
      borderRadius: PANEL.radius,
      backgroundColor: theme.colors.surface,
    },
    locked: {
      borderWidth: LOCKED_BORDER,
      borderStyle: 'dashed',
      borderColor: theme.colors.textMuted,
      backgroundColor: theme.colors.sunken,
    },
    error: { borderColor: theme.colors.danger, backgroundColor: shell.dangerFill },
    regular: { paddingBlock: PANEL.paddingBlock, paddingInline: PANEL.paddingInline },
    compact: { paddingBlock: SPACING.md, paddingInline: PANEL.paddingBlock },
    daily: {
      paddingTop: PANEL.paddingBlock,
      paddingInline: PANEL.paddingBlock,
      paddingBottom: PANEL.paddingInline,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
  });
  return styles;
});

type Styles = ReturnType<typeof useStyles>;

function toneStyle(styles: Styles, tone: PanelTone): ViewStyle | null {
  if (tone === 'locked') return styles.locked;
  if (tone === 'error') return styles.error;
  return null;
}

function paddingStyle(styles: Styles, padding: PanelPadding): ViewStyle {
  if (padding === 'compact') return styles.compact;
  if (padding === 'daily') return styles.daily;
  return styles.regular;
}

/** A flat information card. Never pressable as a whole: put a Button inside it. */
export function Panel(props: PanelProps): ReactNode {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.panel,
        toneStyle(styles, props.tone ?? 'default'),
        paddingStyle(styles, props.padding ?? 'regular'),
        props.isRow === true && styles.row,
        { gap: props.gap ?? SPACING.md },
      ]}
      testID={props.testID}
    >
      {props.children}
    </View>
  );
}
