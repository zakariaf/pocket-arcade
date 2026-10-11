// packages/shell/src/ui/dialog-card.tsx
import { StyleSheet } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { EdgedFace } from './edged-face.tsx';
import { hardShadow } from './toybox-styles.ts';

import type { ReactNode } from 'react';

const DIALOG = COMPONENT_SPECS.dialog;

export type DialogCardProps = {
  /** `reset-progress-dialog`: parts `.card`, `.title`, `.body` (`.art`, `.buttons`, `.scrim` are the caller's). */
  readonly testIDBase: string;
  /** The card's own id when it is not `<base>.card` (the Pause dialog is `pause.dialog`). */
  readonly cardTestID?: string;
  /** Leave out when the children bring their own header (the Pause dialog: title and mode line). */
  readonly title?: string;
  readonly body?: string;
  /** An ArtTile (64, or 56 for the reset dialog) above the title. */
  readonly art?: ReactNode;
  /** The buttons: a DialogButtonRow, or stacked block buttons. */
  readonly children: ReactNode;
  /** The Pause dialog is a little tighter (20 / 18 / 18) and has its own header. */
  readonly variant?: 'regular' | 'pause';
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // The one static hard shadow in Toybox: dialogs float 8 pt above the scrim. The surface is
    // laid inside the edge (EdgedFace), so no pale hairline shows at the rounded corners.
    card: {
      alignSelf: 'stretch',
      gap: DIALOG.gap,
      borderWidth: DIALOG.border,
      borderColor: theme.colors.border,
      borderRadius: DIALOG.radius,
      ...hardShadow(DIALOG.elevation, theme.colors.shadow),
    },
    regular: {
      paddingTop: DIALOG.paddingTop,
      paddingInline: DIALOG.paddingInline,
      paddingBottom: DIALOG.paddingBottom,
    },
    pause: {
      paddingTop: DIALOG.pausePaddingTop,
      paddingInline: DIALOG.pausePaddingInline,
      paddingBottom: DIALOG.pausePaddingBottom,
    },
  });
  return styles;
});

/** A dialog card: optional art, title, body, then the buttons (safe choice at the start). Drawn on a Scrim, which keeps VoiceOver inside. */
export function DialogCard(props: DialogCardProps): ReactNode {
  const styles = useStyles();
  const { colors } = useTheme();
  const base = props.testIDBase;
  return (
    <EdgedFace
      style={[styles.card, props.variant === 'pause' ? styles.pause : styles.regular]}
      edgeColor={colors.border}
      fill={colors.surface}
      edgeWidth={DIALOG.border}
      radius={DIALOG.radius}
      testID={props.cardTestID ?? `${base}.card`}
    >
      {props.art}
      {props.title === undefined ? null : (
        <AppText text={props.title} variant="dialogTitle" isHeader testID={`${base}.title`} />
      )}
      {props.body === undefined ? null : <AppText text={props.body} testID={`${base}.body`} />}
      {props.children}
    </EdgedFace>
  );
}
