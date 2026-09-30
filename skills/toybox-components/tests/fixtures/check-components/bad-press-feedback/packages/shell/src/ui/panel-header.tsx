// packages/shell/src/ui/panel-header.tsx
import { StyleSheet, View } from 'react-native';

import { SPACING } from '@e07/shell/theme/tokens.ts';

import { AppText } from './app-text.tsx';

import type { ReactNode } from 'react';

const HEADER_GAP = 10;

export type PanelHeaderProps = {
  /** Translated heading ("Overview"). */
  readonly title: string;
  /** `<panel>.title`. */
  readonly testID: string;
  /** An IconTile (size statHeader) or a LogoTile (statsHeader) at the start. */
  readonly leading?: ReactNode;
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: HEADER_GAP, marginBottom: SPACING.md },
  title: { flex: 1 },
});

/** A panel's heading row: icon tile (34) or logo tile (36), heading 21, 12 pt above the content. */
export function PanelHeader({ title, testID, leading }: PanelHeaderProps): ReactNode {
  return (
    <View style={styles.header}>
      {leading}
      <View style={styles.title}>
        <AppText text={title} variant="heading" isHeader testID={testID} />
      </View>
    </View>
  );
}
