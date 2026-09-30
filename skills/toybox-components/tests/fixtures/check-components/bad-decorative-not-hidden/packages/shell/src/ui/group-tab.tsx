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
    // A folder tab: edge on top and sides only, overlapping the list's top edge by 3 pt.
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

/** The pop folder tab above a settings list; a heading for VoiceOver. */
export function GroupTab({ title, icon, testID }: GroupTabProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.tab}>
      <Icon name={icon} color={theme.colors.onPop} size={TAB.icon} />
      <AppText text={title} variant="groupTab" tone="onPop" isHeader testID={testID} />
    </View>
  );
}
