// packages/shell/src/ui/stat-list.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { useChromeBaseline } from './use-chrome-baseline.ts';

import type { ReactNode } from 'react';

const LIST = COMPONENT_SPECS.statList;

export type StatListRow = {
  /** Kebab id: the row is `<base>.<id>` with `.label` and `.value`. */
  readonly id: string;
  readonly label: string;
  /** Formatted in the chosen digits. */
  readonly value: string;
};

export type StatListProps = {
  /** `stats.best-scores`: the list is `<base>.list`. */
  readonly testIDBase: string;
  readonly rows: readonly StatListRow[];
  /** A bold first row with no value ("Score", `stats.best-card.score-heading`). */
  readonly heading?: { readonly text: string; readonly testID: string };
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // CSS .slist>div: key and value pushed apart (space-between), 9 pt pads, on one baseline.
    // The baseline comes from Chrome's layout (useChromeBaseline), not from Yoga: iOS reports the
    // baseline of a Persian line that overflows its box differently, which put values 8 pt low.
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: LIST.gap,
      paddingBlock: LIST.rowPaddingBlock,
    },
    // The first row (the heading) has no top pad and no rule (.slist>div:first-child).
    first: { paddingTop: 0 },
    // A 2 pt `line` rule between rows, none above the first.
    rule: { borderTopWidth: LIST.separator, borderColor: SHELL_COLORS[theme.scheme].line },
    // The key keeps its own width (the design measures it), and may shrink to wrap.
    label: { flexShrink: 1 },
  });
  return styles;
});

/** Key / value rows split across the panel (best scores); values are display 22, end-aligned. */
export function StatList({ testIDBase, rows, heading }: StatListProps): ReactNode {
  const styles = useStyles();
  const keyBaseline = useChromeBaseline('statListKey');
  const valueBaseline = useChromeBaseline('statListValue');
  const keyDrop = { marginTop: Math.max(0, valueBaseline - keyBaseline) };
  const valueDrop = { marginTop: Math.max(0, keyBaseline - valueBaseline) };
  const hasHeading = heading !== undefined;
  return (
    <View testID={`${testIDBase}.list`}>
      {heading === undefined ? null : (
        <View style={[styles.row, styles.first]}>
          <AppText text={heading.text} variant="statListHeading" isHeader testID={heading.testID} />
        </View>
      )}
      {rows.map((row, index) => {
        const id = `${testIDBase}.${row.id}`;
        const isRuled = hasHeading || index > 0;
        return (
          <View
            key={row.id}
            style={[styles.row, isRuled ? styles.rule : styles.first]}
            accessible
            testID={id}
          >
            <View style={[styles.label, keyDrop]}>
              <AppText text={row.label} variant="statListKey" testID={`${id}.label`} />
            </View>
            <View style={valueDrop}>
              <AppText
                text={row.value}
                variant="statListValue"
                align="end"
                testID={`${id}.value`}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
