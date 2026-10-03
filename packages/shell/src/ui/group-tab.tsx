// packages/shell/src/ui/group-tab.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

const TAB = COMPONENT_SPECS.groupTab;

export type GroupTabProps = {
  readonly title: string;
  readonly icon: IconName;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // A folder tab: edge on top and sides only. As rendered, it is flush with the list's start edge
    // and sits on the list's top edge (marginStart and overlap are 0 in the as-rendered specs).
    tab: {
      alignSelf: 'flex-start',
      marginStart: TAB.marginStart,
      marginBottom: -TAB.overlap,
      paddingTop: TAB.paddingTop,
      paddingBottom: TAB.paddingBottom,
      paddingInline: TAB.paddingInline,
      flexDirection: 'row',
      alignItems: 'center',
      gap: TAB.gap,
      borderWidth: TAB.border,
      borderBottomWidth: 0,
      borderColor: theme.colors.border,
      borderTopStartRadius: TAB.radiusTop,
      borderTopEndRadius: TAB.radiusTop,
      backgroundColor: theme.colors.pop,
      zIndex: 1,
    },
  });
  return styles;
});

/**
 * The pop folder tab above a settings list; a heading for VoiceOver. The tab View is the one
 * accessible element and carries the testID, so Maestro and the parity bounds measure the whole
 * tab (icon, padding and edge), not only its text.
 */
export function GroupTab({ title, icon, testID }: GroupTabProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View
      style={styles.tab}
      testID={testID}
      accessible
      accessibilityRole="header"
      accessibilityLabel={title}
    >
      <Icon name={icon} color={theme.colors.onPop} size={TAB.icon} />
      <AppText text={title} variant="groupTab" tone="onPop" />
    </View>
  );
}
