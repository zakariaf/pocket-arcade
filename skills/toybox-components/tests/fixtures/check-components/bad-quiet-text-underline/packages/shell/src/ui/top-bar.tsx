// packages/shell/src/ui/top-bar.tsx
import { StyleSheet, View } from 'react-native';

import { LAYOUT } from '@e07/shell/theme/tokens.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { IconButton } from './icon-button.tsx';

import type { ReactNode } from 'react';

const BAR = COMPONENT_SPECS.topBar;
const TOP_PADDING = 4;
const BOTTOM_PADDING = 8;

export type TopBarProps = {
  /** `levels.top-bar`: parts `.back-button` and `.title`. */
  readonly testID: string;
  readonly isReducedMotion: boolean;
  /** Translated screen title (second-level screens). */
  readonly title?: string;
  readonly onBack?: () => void;
  /** Translated "Back". */
  readonly backLabel?: string;
  /** Home only: a slot (the BrandLock) that replaces back and title. */
  readonly start?: ReactNode;
  /** One end action at most: an IconButton or a sticker ("Test build"). */
  readonly end?: ReactNode;
};

const styles = StyleSheet.create({
  bar: {
    minHeight: BAR.minHeight,
    paddingTop: TOP_PADDING,
    paddingBottom: BOTTOM_PADDING,
    paddingInline: LAYOUT.topBarPaddingInline,
    gap: BAR.gap,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { flex: 1 },
});

function startSlot(props: TopBarProps): ReactNode {
  if (props.start !== undefined) return props.start;
  return (
    <>
      {props.onBack === undefined ? null : (
        <IconButton
          icon="back"
          label={props.backLabel ?? ''}
          onPress={props.onBack}
          testID={`${props.testID}.back-button`}
          isReducedMotion={props.isReducedMotion}
        />
      )}
      <View style={styles.title}>
        <AppText
          text={props.title ?? ''}
          variant="topBarTitle"
          isHeader
          testID={`${props.testID}.title`}
        />
      </View>
    </>
  );
}

/** The bar under the status bar: back (mirrors in RTL), title, at most one end action. */
export function TopBar(props: TopBarProps): ReactNode {
  return (
    <View style={styles.bar} testID={props.testID}>
      {startSlot(props)}
      {props.end}
    </View>
  );
}
