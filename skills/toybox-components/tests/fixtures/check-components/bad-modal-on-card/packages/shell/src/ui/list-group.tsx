// packages/shell/src/ui/list-group.tsx
import { StyleSheet, View } from 'react-native';

import { GroupTab } from './group-tab.tsx';
import { List } from './list.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

export type ListGroupProps = {
  /** Translated group name ("Sound and feel"). */
  readonly title: string;
  readonly icon: IconName;
  /** `settings.group.sound`: the tab is `<id>.tab`, the list `<id>.list`. */
  readonly testID: string;
  readonly children: ReactNode;
};

const styles = StyleSheet.create({ group: { alignSelf: 'stretch' } });

/** A settings group: the pop folder tab over a flat list of rows. */
export function ListGroup({ title, icon, testID, children }: ListGroupProps): ReactNode {
  return (
    <View style={styles.group} testID={testID}>
      <GroupTab title={title} icon={icon} testID={`${testID}.tab`} />
      <List testID={`${testID}.list`}>{children}</List>
    </View>
  );
}
