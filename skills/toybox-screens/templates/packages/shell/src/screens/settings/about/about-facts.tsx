// packages/shell/src/screens/settings/about/about-facts.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { List } from '@e07/shell/ui/list.tsx';

import type { ReactNode } from 'react';

export type AboutFactsProps = { readonly isReducedMotion: boolean };

/** S11b facts: three rows without chevrons (made with, works offline, art and sound). */
export function AboutFacts({ isReducedMotion }: AboutFactsProps): ReactNode {
  const t = useT();
  return (
    <List testID="about.facts-list">
      <ListRow
        testID="about.made-with-row"
        icon="hint"
        label={t('about.made-with')}
        isFirst
        isReducedMotion={isReducedMotion}
      />
      <ListRow
        testID="about.offline-row"
        icon="wifi-off"
        label={t('about.offline')}
        isReducedMotion={isReducedMotion}
      />
      <ListRow
        testID="about.art-sound-row"
        icon="music"
        label={t('about.art-sound')}
        isReducedMotion={isReducedMotion}
      />
    </List>
  );
}
