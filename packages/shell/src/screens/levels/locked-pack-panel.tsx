// packages/shell/src/screens/levels/locked-pack-panel.tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { IconTile } from '@e07/shell/ui/icon-tile.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import type { LevelPackModel } from './levels-model.ts';
import type { ReactNode } from 'react';

export type LockedPackPanelProps = { readonly pack: LevelPackModel };

/** Lines inside the locked panel sit 6 pt apart. */
const LOCKED_GAP = 6;

const styles = StyleSheet.create({
  // The design's .pk-h is one wrapping row (gap 6 x 10; the heading flex 1 1 auto): the Locked
  // sticker sits at the row's end beside a heading that fits on one line there, and drops below a
  // heading that needs the whole row. Yoga does not break a flex-basis-auto row like CSS, so the
  // heading's line count in the row decides the break.
  header: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  heading: { flex: 1 },
  badge: { alignSelf: 'flex-start' },
});

/** S8 next locked pack: a dashed, sunken panel with the padlock, "Locked", the star requirement. */
export function LockedPackPanel({ pack }: LockedPackPanelProps): ReactNode {
  const t = useT();
  const id = `levels.pack.${String(pack.number)}`;
  const headingText = t('levels.pack.heading', { packNumber: pack.number, packName: pack.name });
  // The heading that wrapped beside the sticker: the sticker then drops below it. Only the row's
  // own measure decides, so the wider heading below never flips the layout back.
  const [wrappedHeading, setWrappedHeading] = useState<string | null>(null);
  const isWrapped = wrappedHeading === headingText;
  const handleHeadingLines = (lines: number): void => {
    if (!isWrapped && lines > 1) setWrappedHeading(headingText);
  };
  const badge = (
    <Sticker
      testID={`${id}.locked-badge`}
      text={t('levels.pack.locked-badge')}
      paper="ink"
      size="sm"
      icon="lock"
      tiltDeg={-4}
    />
  );
  return (
    <Panel testID={id} tone="locked" gap={LOCKED_GAP}>
      <View style={styles.header}>
        <IconTile testID={`${id}.icon`} icon="lock" paint="plain" />
        <View style={styles.heading}>
          <AppText
            text={headingText}
            variant="heading"
            isHeader
            onLineCount={handleHeadingLines}
            testID={`${id}.heading`}
          />
        </View>
        {isWrapped ? null : <View>{badge}</View>}
      </View>
      {isWrapped ? <View style={styles.badge}>{badge}</View> : null}
      <AppText
        text={t('levels.pack.requirement', { starsCount: pack.unlockStars })}
        variant="label"
        testID={`${id}.requirement`}
      />
      <AppText
        text={t('levels.pack.locked', { starsCount: pack.missingStars, packName: pack.name })}
        tone="muted"
        testID={`${id}.explanation`}
      />
    </Panel>
  );
}
