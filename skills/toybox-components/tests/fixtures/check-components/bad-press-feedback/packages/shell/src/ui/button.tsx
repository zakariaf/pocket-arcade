// packages/shell/src/ui/button.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { BusyBlocks } from './busy-blocks.tsx';
import { kindPaint } from './button-paint.ts';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { QuietButton } from './quiet-button.tsx';
import { RaisedSurface } from './raised-surface.tsx';

import type { KindPaint, RaisedKind } from './button-paint.ts';
import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

const BUTTON = COMPONENT_SPECS.button;
const HERO = COMPONENT_SPECS.heroKey;

export type ButtonKind = RaisedKind | 'quiet';

export type ButtonProps = {
  /** Translated; also the accessibility label. */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  /** From useReduceMotion() in the screen model. */
  readonly isReducedMotion: boolean;
  /** Default 'secondary'. Only one 'primary' hero key per screen. */
  readonly kind?: ButtonKind;
  /** 'hero' = the 80 pt key (Play, Next, Resume, Try again, Buy); always a block. */
  readonly size?: 'regular' | 'hero';
  /** Icon at the start of the label. */
  readonly icon?: IconName;
  /** Icon at the end (forward arrows: Next, Continue). */
  readonly iconEnd?: IconName;
  /** Hero keys only: the 50 pt square at the start holding a 26 pt icon. */
  readonly cap?: IconName;
  /** Stretch to the width of the body (block buttons). */
  readonly isBlock?: boolean;
  /** Share a row with other buttons (dialog rows, Replay / Levels): grow from a 120 pt basis. */
  readonly isInRow?: boolean;
  readonly isDisabled?: boolean;
  /** Keeps the label, replaces the icon with hopping blocks, ignores presses. */
  readonly isBusy?: boolean;
  readonly hint?: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    face: {
      minHeight: BUTTON.minHeight,
      paddingBlock: BUTTON.paddingBlock,
      paddingInline: BUTTON.paddingInline,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: BUTTON.gap,
    },
    heroFace: { minHeight: HERO.minHeight, paddingBlock: HERO.paddingBlock },
    heroWithCap: { paddingStart: HERO.paddingStartWithCap, justifyContent: 'flex-start' },
    cap: {
      width: HERO.capSize,
      height: HERO.capSize,
      borderRadius: HERO.capRadius,
      borderWidth: HERO.capBorder,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { flexShrink: 1 },
    block: { alignSelf: 'stretch' },
    inline: { alignSelf: 'flex-start' },
    inRow: { flexGrow: 1, flexShrink: 1, flexBasis: COMPONENT_SPECS.dialog.buttonMinBasis },
  });
  return styles;
});

type Styles = ReturnType<typeof useStyles>;

function capSlot(props: ButtonProps, styles: Styles, iconColor: string): ReactNode {
  if (props.size !== 'hero' || props.cap === undefined) return null;
  return (
    <View style={styles.cap}>
      <Icon name={props.cap} color={iconColor} size={HERO.capIcon} />
    </View>
  );
}

function endSlot(props: ButtonProps, paint: KindPaint): ReactNode {
  if (props.iconEnd === undefined) return null;
  return <Icon name={props.iconEnd} color={paint.content} size={BUTTON.iconSize} />;
}

function startSlot(props: ButtonProps, paint: KindPaint): ReactNode {
  if (props.isBusy === true) {
    return (
      <BusyBlocks size="button" color={paint.content} isReducedMotion={props.isReducedMotion} />
    );
  }
  if (props.icon === undefined) return null;
  return <Icon name={props.icon} color={paint.content} size={BUTTON.iconSize} />;
}

type Layout = {
  readonly elevation: number;
  readonly faceStyle: StyleProp<ViewStyle>;
  readonly layoutStyle: StyleProp<ViewStyle>;
  readonly variant: 'heroKeyLabel' | 'label';
  readonly align: 'start' | 'center';
};

/** Hero keys are 80 pt blocks with an optional start cap; regular buttons are 54 pt. */
function layoutOf(props: ButtonProps, styles: Styles): Layout {
  const isHero = props.size === 'hero';
  const hasCap = isHero && props.cap !== undefined;
  const isBlock = isHero || props.isBlock === true;
  const outer = isBlock ? styles.block : styles.inline;
  return {
    elevation: isHero ? HERO.elevation : BUTTON.elevation,
    faceStyle: [styles.face, isHero && styles.heroFace, hasCap && styles.heroWithCap],
    layoutStyle: props.isInRow === true ? styles.inRow : outer,
    variant: isHero ? 'heroKeyLabel' : 'label',
    align: hasCap ? 'start' : 'center',
  };
}

/** A Toybox button: raised key (primary, secondary, pop, danger) or a quiet nudge. */
export function Button(props: ButtonProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  const kind = props.kind ?? 'secondary';
  if (kind === 'quiet') return <QuietButton {...props} />;
  const isDisabled = props.isDisabled === true;
  const paint = kindPaint(theme, kind, isDisabled);
  const layout = layoutOf(props, styles);
  return (
    <RaisedSurface
      label={props.label}
      onPress={props.onPress}
      testID={props.testID}
      elevation={layout.elevation}
      radius={BUTTON.radius}
      fill={paint.fill}
      edgeColor={paint.edge}
      isReducedMotion={props.isReducedMotion}
      isDisabled={isDisabled}
      isBusy={props.isBusy === true}
      {...(props.hint === undefined ? {} : { hint: props.hint })}
      faceStyle={layout.faceStyle}
      layoutStyle={layout.layoutStyle}
    >
      {capSlot(props, styles, theme.colors.icon)}
      {startSlot(props, paint)}
      <View style={styles.label}>
        <AppText
          text={props.label}
          variant={layout.variant}
          tone={paint.tone}
          align={layout.align}
        />
      </View>
      {endSlot(props, paint)}
    </RaisedSurface>
  );
}
