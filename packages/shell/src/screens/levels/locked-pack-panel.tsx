// packages/shell/src/screens/levels/locked-pack-panel.tsx
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
  // The design's .pk-h wraps (gap 6 x 10): the heading takes its line and the Locked sticker
  // drops below it. Yoga does not break a flex-basis-auto row like CSS, so the break is explicit.
  header: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  heading: { flex: 1 },
  badge: { alignSelf: 'flex-start' },
});

/** S8 next locked pack: a dashed, sunken panel with the padlock, "Locked", the star requirement. */
export function LockedPackPanel({ pack }: LockedPackPanelProps): ReactNode {
  const t = useT();
  const id = `levels.pack.${String(pack.number)}`;
  return (
    <Panel testID={id} tone="locked" gap={LOCKED_GAP}>
      <View style={styles.header}>
        <IconTile testID={`${id}.icon`} icon="lock" paint="plain" />
        <View style={styles.heading}>
          <AppText
            text={t('levels.pack.heading', { packNumber: pack.number, packName: pack.name })}
            variant="heading"
            isHeader
            testID={`${id}.heading`}
          />
        </View>
      </View>
      <View style={styles.badge}>
        <Sticker
          testID={`${id}.locked-badge`}
          text={t('levels.pack.locked-badge')}
          paper="ink"
          size="sm"
          icon="lock"
          tiltDeg={-4}
        />
      </View>
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
