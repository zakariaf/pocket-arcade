// packages/shell/src/ui/empty-state.tsx
import { StyleSheet, View } from 'react-native';

import { LAYOUT } from '@e07/shell/theme/tokens.ts';

import { AppText } from './app-text.tsx';

import type { ReactNode } from 'react';

export type EmptyStateProps = {
  /** `stats.empty-state`: parts `.picture`, `.title` and `.body`. */
  readonly testIDBase: string;
  /** The 190 pt EmptyStatsPicture (code-drawn art). */
  readonly picture: ReactNode;
  readonly title: string;
  readonly body: string;
  /** The hero key with a play cap (`stats.play-button`). */
  readonly action: ReactNode;
  /** The local-data note under the key (`stats.local-note`). */
  readonly footer?: ReactNode;
};

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: LAYOUT.blockGap,
  },
  action: { alignSelf: 'stretch' },
});

/** The S10 new-player column: picture, title, lead, hero key, note; start-aligned. */
export function EmptyState(props: EmptyStateProps): ReactNode {
  const base = props.testIDBase;
  return (
    <View style={styles.empty} testID={base}>
      <View testID={`${base}.picture`}>{props.picture}</View>
      <AppText text={props.title} variant="title" isHeader testID={`${base}.title`} />
      <AppText text={props.body} variant="lead" testID={`${base}.body`} />
      <View style={styles.action}>{props.action}</View>
      {props.footer}
    </View>
  );
}
