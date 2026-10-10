// packages/shell/src/screens/levels/pack-tile.tsx
// One S8 grid tile. Its props are the tile model, its column width, its focus and motion flags and
// the pack's one press handler, so when the tapped locked tile changes only the tiles whose focus
// changed get new props; the label, hint and press handler are built here, per tile.
import { useT } from '@e07/shell/i18n/t-context.ts';
import { LevelTile } from '@e07/shell/ui/level-tile.tsx';

import type { LevelTileModel } from './levels-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { ReactNode } from 'react';

export type PackTileProps = {
  readonly tile: LevelTileModel;
  /** Column width from the grid layout (tileWidthFor). */
  readonly width: number;
  /** The tapped locked tile: focus ring while its toast is up. */
  readonly isFocused: boolean;
  readonly isReducedMotion: boolean;
  readonly onPressTile: (tile: LevelTileModel) => void;
};

/** The tile's VoiceOver label: "Level 12: 2 stars", "Level 13: no stars yet", "Level 14, locked". */
function tileLabel(t: TFunction, tile: LevelTileModel): string {
  if (tile.state.kind === 'locked') {
    return t('levels.level-tile.locked.a11y-label', { level: tile.level });
  }
  const stars = tile.state.kind === 'completed' ? tile.state.stars : 0;
  return t('levels.level-tile.a11y-label', { level: tile.level, starsCount: stars });
}

/** A level tile of a pack's grid, with its VoiceOver label and its press. */
export function PackTile({
  tile,
  width,
  isFocused,
  isReducedMotion,
  onPressTile,
}: PackTileProps): ReactNode {
  const t = useT();
  return (
    <LevelTile
      testID={`levels.level-tile.${String(tile.level)}`}
      numberText={tile.numberText}
      state={tile.state}
      label={tileLabel(t, tile)}
      {...(tile.state.kind === 'locked' ? { hint: t('levels.level-tile.locked.a11y-hint') } : {})}
      onPress={() => {
        onPressTile(tile);
      }}
      width={width}
      isFocused={isFocused}
      isReducedMotion={isReducedMotion}
    />
  );
}
