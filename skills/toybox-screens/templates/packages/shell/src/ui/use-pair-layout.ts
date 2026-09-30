// packages/shell/src/ui/use-pair-layout.ts
import { StyleSheet } from 'react-native';

import { useWindowClass } from './use-window-class.ts';

import type { ViewStyle } from 'react-native';

export type PairLayout = {
  /** The container: a row, or a column at 200 % text. */
  readonly row: ViewStyle;
  /** Each item: an equal share of the row, or the full width when stacked. */
  readonly item: ViewStyle;
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  item: { flex: 1, flexBasis: 0 },
  stacked: { alignSelf: 'stretch' },
});

/**
 * Side-by-side blocks (two buttons, the Home keys, the streak panels, 3-column stat grids)
 * stack vertically at 200 % text instead of squeezing their labels. Gap 12 for pairs, 10 for keys.
 */
export function usePairLayout(gap: number): PairLayout {
  const { isLargeText } = useWindowClass();
  return {
    row: { ...(isLargeText ? styles.column : styles.row), gap },
    item: isLargeText ? styles.stacked : styles.item,
  };
}
