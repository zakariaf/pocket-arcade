// packages/shell/src/ui/row-button.tsx
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { kindPaint } from './button-paint.ts';
import { COMPONENT_SPECS } from './component-specs.ts';
import { IconTile } from './icon-tile.tsx';
import { Icon } from './icons/icon.tsx';
import { RaisedSurface } from './raised-surface.tsx';

import type { IconTilePaint } from './icon-tile.tsx';
import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

const ROW = COMPONENT_SPECS.rowButton;
const BUTTON = COMPONENT_SPECS.button;

export type RowButtonProps = {
  readonly label: string;
  /** One short line under the label ("Best 4,210", the Premium hint). */
  readonly description?: string;
  /** The 38 pt icon tile at the start (`<testID>.icon`). */
  readonly icon: IconName;
  /** 'accent' on the Endless card, 'gold' on the Premium key (default 'pop'). */
  readonly iconPaint?: IconTilePaint;
  readonly onPress: () => void;
  readonly testID: string;
  readonly isReducedMotion: boolean;
  /** 'secondary' (Endless) or 'pop' (the Premium key). */
  readonly kind?: 'secondary' | 'pop';
  readonly hint?: string;
};

const styles = StyleSheet.create({
  face: {
    minHeight: ROW.minHeight,
    paddingBlock: ROW.paddingBlock,
    paddingInline: ROW.paddingInline,
    gap: ROW.gap,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  text: { flex: 1, gap: ROW.labelGap },
  block: { alignSelf: 'stretch' },
});

/** A menu card: raised block key laid out as a row (icon tile, label and description, chevron). */
export function RowButton(props: RowButtonProps): ReactNode {
  const theme = useTheme();
  const kind = props.kind ?? 'secondary';
  const paint = kindPaint(theme, kind, false);
  const accessibleName =
    props.description === undefined ? props.label : `${props.label}, ${props.description}`;
  return (
    <RaisedSurface
      label={accessibleName}
      onPress={props.onPress}
      testID={props.testID}
      elevation={BUTTON.elevation}
      radius={BUTTON.radius}
      fill={paint.fill}
      isReducedMotion={props.isReducedMotion}
      {...(props.hint === undefined ? {} : { hint: props.hint })}
      faceStyle={styles.face}
      layoutStyle={styles.block}
    >
      <IconTile
        icon={props.icon}
        paint={props.iconPaint ?? 'pop'}
        testID={`${props.testID}.icon`}
      />
      <View style={styles.text}>
        <AppText
          text={props.label}
          variant="label"
          tone={paint.tone}
          testID={`${props.testID}.label`}
        />
        {props.description === undefined ? null : (
          <AppText
            text={props.description}
            variant="rowButtonDescription"
            tone={kind === 'pop' ? 'onPop' : 'muted'}
            testID={`${props.testID}.description`}
          />
        )}
      </View>
      <Icon name="chevron" color={paint.content} size={ROW.chevron} />
    </RaisedSurface>
  );
}
