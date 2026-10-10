// packages/shell/src/screens/levels/pack-section.tsx
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { ProgressBar } from '@e07/shell/ui/progress-bar.tsx';
import { RatingStar } from '@e07/shell/ui/rating-star.tsx';

import { PackTile } from './pack-tile.tsx';
import { LEVEL_COLUMN_GAP, tileWidthFor } from './tile-width.ts';

import type { LevelPackModel, LevelTileModel } from './levels-model.ts';
import type { ReactNode } from 'react';

export type PackSectionProps = {
  readonly pack: LevelPackModel;
  readonly focusedLevel: number | null;
  readonly isReducedMotion: boolean;
  readonly onPressTile: (tile: LevelTileModel) => void;
};

/** The filled star before "28 / 90" (inline size). */
const PROGRESS_STAR = 22;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 6,
    columnGap: 10,
  },
  heading: { flex: 1 },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 16,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: LEVEL_COLUMN_GAP },
});

/** S8 pack: heading and level count, the stars progress line, then the 6-column level grid. */
export function PackSection({
  pack,
  focusedLevel,
  isReducedMotion,
  onPressTile,
}: PackSectionProps): ReactNode {
  const t = useT();
  const { width, scale } = useWindowDimensions();
  const tileWidth = tileWidthFor(width, scale);
  const id = `levels.pack.${String(pack.number)}`;
  const progressText = t('levels.pack.progress', {
    earned: pack.earnedStars,
    total: pack.totalStars,
  });
  return (
    <View testID={id}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <AppText
            text={t('levels.pack.heading', { packNumber: pack.number, packName: pack.name })}
            variant="heading"
            isHeader
            testID={`${id}.heading`}
          />
        </View>
        <AppText
          text={t('levels.pack.level-count', { levelsCount: pack.levelsCount })}
          tone="muted"
          testID={`${id}.count`}
        />
      </View>
      <View style={styles.progress} testID={`${id}.progress`}>
        {/* RatingStar takes no testID: the map's `.progress-star` sits on this wrapper. */}
        <View testID={`${id}.progress-star`}>
          <RatingStar isFilled size={PROGRESS_STAR} />
        </View>
        <AppText text={progressText} variant="packProgress" testID={`${id}.progress-label`} />
        <ProgressBar testID={`${id}.progress-bar`} label={progressText} value={pack.progress} />
      </View>
      <View style={styles.tiles} testID={`${id}.tiles`}>
        {pack.tiles.map((tile) => (
          <PackTile
            key={tile.level}
            tile={tile}
            width={tileWidth}
            isFocused={tile.level === focusedLevel}
            isReducedMotion={isReducedMotion}
            onPressTile={onPressTile}
          />
        ))}
      </View>
    </View>
  );
}
