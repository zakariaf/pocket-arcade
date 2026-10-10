// packages/shell/src/screens/stats/stats-empty-state.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';
import { EmptyState } from '@e07/shell/ui/empty-state.tsx';
import { EmptyStatsPicture } from '@e07/shell/ui/empty-stats-picture.tsx';

import { StatsLocalNote } from './stats-local-note.tsx';

import type { ReactNode } from 'react';

export type StatsEmptyStateProps = {
  readonly onPlay: () => void;
  readonly isReducedMotion: boolean;
};

/**
 * S10 for a new player: the boxed-star picture, title, lead, a hero "Play a level" and the
 * local-data note. EmptyState derives stats.empty-state.picture, .title and .body from its base.
 */
export function StatsEmptyState({ onPlay, isReducedMotion }: StatsEmptyStateProps): ReactNode {
  const t = useT();
  return (
    <EmptyState
      testIDBase="stats.empty-state"
      picture={<EmptyStatsPicture />}
      title={t('stats.empty.title')}
      body={t('stats.empty.body')}
      action={
        <Button
          testID="stats.play-button"
          label={t('stats.empty.play-button')}
          onPress={onPlay}
          kind="primary"
          size="hero"
          cap="play"
          isBlock
          isReducedMotion={isReducedMotion}
        />
      }
      footer={<StatsLocalNote />}
    />
  );
}
