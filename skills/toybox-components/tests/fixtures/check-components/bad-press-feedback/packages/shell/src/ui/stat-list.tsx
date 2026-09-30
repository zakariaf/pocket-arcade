// packages/shell/src/ui/stat-list.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';

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
    row: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: LIST.gap,
      paddingBlock: LIST.rowPaddingBlock,
    },
    // A 2 pt `line` rule between rows, none above the first.
    rule: { borderTopWidth: LIST.separator, borderColor: SHELL_COLORS[theme.scheme].line },
    label: { flex: 1 },
  });
  return styles;
});

/** Key / value rows split across the panel (best scores); values are display 22, end-aligned. */
export function StatList({ testIDBase, rows, heading }: StatListProps): ReactNode {
  const styles = useStyles();
  const hasHeading = heading !== undefined;
  return (
    <View testID={`${testIDBase}.list`}>
      {heading === undefined ? null : (
        <View style={styles.row}>
          <AppText text={heading.text} variant="label" isHeader testID={heading.testID} />
        </View>
      )}
      {rows.map((row, index) => {
        const id = `${testIDBase}.${row.id}`;
        const isRuled = hasHeading || index > 0;
        return (
          <View
            key={row.id}
            style={[styles.row, isRuled ? styles.rule : null]}
            accessible
            testID={id}
          >
            <View style={styles.label}>
              <AppText text={row.label} variant="statListKey" testID={`${id}.label`} />
            </View>
            <AppText text={row.value} variant="statListValue" align="end" testID={`${id}.value`} />
          </View>
        );
      })}
    </View>
  );
}
