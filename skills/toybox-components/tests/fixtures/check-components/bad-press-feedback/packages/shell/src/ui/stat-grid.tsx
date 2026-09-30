// packages/shell/src/ui/stat-grid.tsx
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const GRID = COMPONENT_SPECS.statGrid;

export type StatCell = {
  /** Kebab id: the cell is `<panel>.<id>` with `.value` and `.label`. */
  readonly id: string;
  /** Formatted in the chosen digits ("1,240", "۱۲۴۰"). */
  readonly value: string;
  /** Translated ("Games played"). */
  readonly label: string;
};

export type StatGridProps = {
  readonly cells: readonly StatCell[];
  /** The panel's testID, e.g. `stats.overview`. */
  readonly testIDBase: string;
  /** 2 columns (default) or 3 (the compact per-mode grid: 23 pt values, no wrap). */
  readonly columns?: 2 | 3;
};

const styles = StyleSheet.create({
  grid: { gap: GRID.gap },
  row: { flexDirection: 'row', gap: GRID.gap },
  cell: { flex: 1, gap: GRID.cellGap },
});

function rowsOf(cells: readonly StatCell[], columns: number): readonly (readonly StatCell[])[] {
  const rows: StatCell[][] = [];
  cells.forEach((cell, index) => {
    if (index % columns === 0) rows.push([]);
    rows.at(-1)?.push(cell);
  });
  return rows;
}

function cellView(cell: StatCell, id: string, isCompact: boolean): ReactNode {
  return (
    <View key={cell.id} style={styles.cell} accessible testID={id}>
      <AppText
        text={cell.value}
        variant={isCompact ? 'statValueCompact' : 'number'}
        testID={`${id}.value`}
        {...(isCompact ? { numberOfLines: 1 } : {})}
      />
      <AppText text={cell.label} variant="statLabel" tone="muted" testID={`${id}.label`} />
    </View>
  );
}

/** Stat cells (value over label) in rows of 2 or 3; a short last row keeps the column widths. */
export function StatGrid({ cells, testIDBase, columns = 2 }: StatGridProps): ReactNode {
  const isCompact = columns === GRID.columnsCompact;
  return (
    <View style={styles.grid}>
      {rowsOf(cells, columns).map((row) => (
        <View key={row.map((cell) => cell.id).join('|')} style={styles.row}>
          {row.map((cell) => cellView(cell, `${testIDBase}.${cell.id}`, isCompact))}
          {Array.from({ length: columns - row.length }, (_, index) => (
            <View key={`gap-${String(index)}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}
