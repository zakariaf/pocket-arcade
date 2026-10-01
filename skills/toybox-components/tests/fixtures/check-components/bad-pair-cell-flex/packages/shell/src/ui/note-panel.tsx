// packages/shell/src/ui/note-panel.tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { IconTile } from './icon-tile.tsx';
import { Icon } from './icons/icon.tsx';
import { Panel } from './panel.tsx';

import type { IconTilePaint } from './icon-tile.tsx';
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
  /**
   * The icon on a 38 pt tile of this paint, centred on the text (the S11a right-to-left note: a
   * pop globe tile); without it a bare 22 pt icon sits at the top.
   */
  readonly iconTile?: IconTilePaint;
};

const styles = StyleSheet.create({
  // The 22 pt icon sits at the top (.note-p: align-items flex-start), 2 pt lower so it lines up
  // with the first line of text.
  icon: { alignSelf: 'flex-start', marginTop: NOTE_ICON_NUDGE },
  tile: { alignSelf: 'center' },
  text: { flex: 1 },
  // The design's <p> is a flex item as wide as its text: a one-line note ends where its text ends
  // (a right-to-left note's box starts at its first word, not at the icon).
  oneLine: { flexShrink: 1 },
});

/** A panel laid out as a row: an icon at the start and body text, top-aligned. */
export function NotePanel(props: NotePanelProps): ReactNode {
  const theme = useTheme();
  const isError = props.isError === true;
  // The text that laid out on one line: that note's box fits its text, a longer one fills the row.
  const [oneLineText, setOneLineText] = useState<string | null>(null);
  const isOneLine = oneLineText === props.text;
  const onLineCount = (lines: number): void => {
    setOneLineText(lines === 1 ? props.text : null);
  };
  return (
    <Panel testID={props.testID} tone={isError ? 'error' : 'default'} isRow>
      {props.iconTile === undefined ? (
        <View style={styles.icon}>
          <Icon
            name={props.icon}
            color={isError ? theme.colors.danger : theme.colors.icon}
            size={NOTE_ICON}
            testID={`${props.testID}.icon`}
          />
        </View>
      ) : (
        <View style={styles.tile}>
          <IconTile icon={props.icon} paint={props.iconTile} testID={`${props.testID}.icon`} />
        </View>
      )}
      <View style={isOneLine ? styles.oneLine : styles.text}>
        <AppText
          text={props.text}
          onLineCount={onLineCount}
          // Strong notes are the body in Bold (17, line height 1.32 / 1.5), as the design's <b>.
          variant={props.isStrong === true ? 'rowLabelStrong' : 'body'}
          testID={`${props.testID}.label`}
        />
      </View>
    </Panel>
  );
}
