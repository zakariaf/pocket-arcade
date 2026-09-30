// packages/shell/src/ui/note-panel.tsx
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { Icon } from './icons/icon.tsx';
import { Panel } from './panel.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

const NOTE_ICON = 22;
const NOTE_ICON_NUDGE = 2;

export type NotePanelProps = {
  readonly icon: IconName;
  /** Translated note text. */
  readonly text: string;
  readonly testID: string;
  /** The S12 error note: danger edge on dangerFill, danger icon. */
  readonly isError?: boolean;
  /** Bold note text (the S12 pending state). */
  readonly isStrong?: boolean;
};

const styles = StyleSheet.create({
  // The 22 pt icon sits 2 pt lower so it lines up with the first line of text.
  icon: { marginTop: NOTE_ICON_NUDGE },
  text: { flex: 1 },
});

/** A panel laid out as a row: an icon at the start and body text, top-aligned. */
export function NotePanel(props: NotePanelProps): ReactNode {
  const theme = useTheme();
  const isError = props.isError === true;
  return (
    <Panel testID={props.testID} tone={isError ? 'error' : 'default'} isRow>
      <View style={styles.icon}>
        <Icon
          name={props.icon}
          color={isError ? theme.colors.danger : theme.colors.icon}
          size={NOTE_ICON}
          testID={`${props.testID}.icon`}
        />
      </View>
      <View style={styles.text}>
        <AppText
          text={props.text}
          variant={props.isStrong === true ? 'label' : 'body'}
          testID={`${props.testID}.label`}
        />
      </View>
    </Panel>
  );
}
