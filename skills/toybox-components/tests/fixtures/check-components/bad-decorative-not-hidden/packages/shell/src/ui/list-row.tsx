// packages/shell/src/ui/list-row.tsx
import { Pressable, StyleSheet, View } from 'react-native';

import { usePressFeedback } from '@e07/shell/app/press-feedback-context.tsx';
import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { IconTile } from './icon-tile.tsx';
import { Icon } from './icons/icon.tsx';
import { RadioMark } from './radio-mark.tsx';
import { Toggle } from './toggle.tsx';

import type { IconTileIcon, IconTilePaint } from './icon-tile.tsx';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { TypeVariant } from '@e07/shell/theme/type-styles.ts';
import type { ReactNode } from 'react';
import type {
  AccessibilityRole,
  AccessibilityState,
  PressableStateCallbackType,
} from 'react-native';

const ROW = COMPONENT_SPECS.row;

/** What sits at the end: a chevron (opens a page), a toggle (switch), a radio mark, or nothing. */
export type ListRowEnd = 'chevron' | 'toggle' | 'radio' | 'none';

export type ListRowProps = {
  readonly label: string;
  readonly testID: string;
  readonly isReducedMotion: boolean;
  readonly end?: ListRowEnd;
  /** The 38 pt icon tile at the start (`<testID>.icon`); danger rows paint it danger. */
  readonly icon?: IconTileIcon;
  readonly iconPaint?: IconTilePaint;
  readonly description?: string;
  /** The description's own testID when the map names it (S11d `.licence`); default `.description`. */
  readonly descriptionTestID?: string;
  /**
   * More lines in the text column under the description (S11d's column row: a second muted line
   * and the centred "Show licence text" nudge). The column then keeps each part at its own width.
   */
  readonly textExtra?: ReactNode;
  /** Muted value before the chevron ("System (English)", "12"). */
  readonly value?: string;
  /** For end="toggle". */
  readonly isOn?: boolean;
  /** For end="radio". */
  readonly isSelected?: boolean;
  readonly onPress?: () => void;
  /** Destructive rows: bold danger label and a danger icon tile. */
  readonly isDanger?: boolean;
  /** A bold label in the normal ink, e.g. S11 "Remove ads – €1.99" (the design's strong row). */
  readonly isStrong?: boolean;
  /** The first row of a list draws no separator. */
  readonly isFirst?: boolean;
  /** Wrap rows put this under the label at full width (a segmented control). */
  readonly below?: ReactNode;
  /** Autonym rows use their own script. */
  readonly labelLanguage?: Language;
  readonly hint?: string;
};

const ROLE: Readonly<Record<ListRowEnd, AccessibilityRole | undefined>> = {
  chevron: 'button',
  toggle: 'switch',
  radio: 'radio',
  none: undefined,
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    row: {
      minHeight: ROW.minHeight,
      paddingBlock: ROW.paddingBlock,
      paddingInline: ROW.paddingInline,
      gap: ROW.gap,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      // A single line of parts shorter than the 60 pt row sits in its middle, as CSS centres a
      // one-line flex row (align-content: normal); Yoga's default put it at the top (S11a).
      alignContent: 'center',
    },
    separated: { borderTopWidth: ROW.separator, borderTopColor: SHELL_COLORS[theme.scheme].line },
    pressed: { backgroundColor: theme.colors.sunken },
    text: { flex: 1, gap: ROW.labelGap },
    // A column row (textExtra): each part keeps its own width, as the design's lic-x column.
    textColumn: { alignItems: 'flex-start' },
    below: { flexBasis: '100%' },
  });
  return styles;
});

function endSlot(props: ListRowProps, color: string): ReactNode {
  switch (props.end ?? 'none') {
    case 'chevron':
      return <Icon name="chevron" color={color} size={ROW.chevron} />;
    case 'toggle':
      return (
        <Toggle
          isOn={props.isOn === true}
          isReducedMotion={props.isReducedMotion}
          testID={`${props.testID}.toggle`}
        />
      );
    case 'radio':
      return <RadioMark isSelected={props.isSelected === true} testID={`${props.testID}.radio`} />;
    case 'none':
      return null;
  }
}

type Styles = ReturnType<typeof useStyles>;

/** Autonyms (S11a) are the option name in 18 Bold; strong and danger labels the row label Bold. */
function labelVariantOf(props: ListRowProps): TypeVariant {
  if (props.labelLanguage !== undefined) return 'optionNameList';
  return props.isDanger === true || props.isStrong === true ? 'rowLabelStrong' : 'rowLabel';
}

function rowContent(props: ListRowProps, styles: Styles, color: string): ReactNode {
  const isDanger = props.isDanger === true;
  const tilePaint = isDanger ? 'danger' : (props.iconPaint ?? 'pop');
  return (
    <>
      {props.icon === undefined ? null : (
        <IconTile icon={props.icon} paint={tilePaint} testID={`${props.testID}.icon`} />
      )}
      <View style={[styles.text, props.textExtra === undefined ? null : styles.textColumn]}>
        <AppText
          text={props.label}
          // Strong and danger labels are the row label in Bold (17, line height 1.32 / 1.5),
          // not the button label role (1.25), which made each line 1.2 pt short of the design.
          variant={labelVariantOf(props)}
          tone={isDanger ? 'danger' : 'default'}
          testID={`${props.testID}.label`}
          {...(props.labelLanguage === undefined ? {} : { language: props.labelLanguage })}
        />
        {props.description === undefined ? null : (
          <AppText
            text={props.description}
            variant="rowDescription"
            tone="muted"
            testID={props.descriptionTestID ?? `${props.testID}.description`}
          />
        )}
        {props.textExtra}
      </View>
      {props.value === undefined ? null : (
        <AppText
          text={props.value}
          variant="rowValue"
          tone="muted"
          align="end"
          testID={`${props.testID}.value`}
        />
      )}
      {endSlot(props, color)}
    </>
  );
}

function stateOf(props: ListRowProps): AccessibilityState {
  if (props.end === 'toggle') return { checked: props.isOn === true };
  if (props.end === 'radio') return { selected: props.isSelected === true };
  return {};
}

/**
 * A flat 60 pt settings row; the whole row is the target (button, switch or radio). A press runs
 * the tap feedback first, except on a switch row: its handler plays the toggle feedback.
 */
export function ListRow(props: ListRowProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  const onPressFeedback = usePressFeedback();
  const role = ROLE[props.end ?? 'none'];
  const base = [styles.row, props.isFirst !== true && styles.separated];
  const content = rowContent(props, styles, theme.colors.textMuted);
  const below = props.below === undefined ? null : <View style={styles.below}>{props.below}</View>;
  const { onPress } = props;
  if (role === undefined || onPress === undefined) {
    return (
      <View style={base} testID={props.testID}>
        {content}
        {below}
      </View>
    );
  }
  return (
    <Pressable
      // No accessibilityLabel: VoiceOver reads the row's texts (label, description, value) in order.
      accessibilityRole={role}
      {...(props.hint === undefined ? {} : { accessibilityHint: props.hint })}
      accessibilityState={stateOf(props)}
      onPress={() => {
        if (role !== 'switch') onPressFeedback();
        onPress();
      }}
      style={(state: PressableStateCallbackType) => [...base, state.pressed && styles.pressed]}
      testID={props.testID}
    >
      {content}
      {below}
    </Pressable>
  );
}
