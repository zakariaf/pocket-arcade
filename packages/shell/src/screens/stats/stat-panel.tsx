// packages/shell/src/screens/stats/stat-panel.tsx
import { IconTile } from '@e07/shell/ui/icon-tile.tsx';
import { LogoTile } from '@e07/shell/ui/logo-tile.tsx';
import { PanelHeader } from '@e07/shell/ui/panel-header.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { IconName } from '@e07/shell/ui/icons/icon-paths.ts';
import type { ReactNode } from 'react';

/** The header's start: a 34 pt pop icon tile, or the game panel's 36 pt logo tile. */
export type StatPanelLeading =
  | { readonly kind: 'icon'; readonly icon: IconName | 'rating-star' }
  | { readonly kind: 'logo'; readonly logo: LogoArt };

export type StatPanelProps = {
  /** stats.<card>: the header parts are <testID>.icon (or .logo) and <testID>.title. */
  readonly testID: string;
  readonly leading: StatPanelLeading;
  readonly title: string;
  readonly children: ReactNode;
};

/** S10 stat panel: PanelHeader (icon tile 34 or logo tile 36 + heading 21), then its grid or list. */
export function StatPanel({ testID, leading, title, children }: StatPanelProps): ReactNode {
  const start =
    leading.kind === 'icon' ? (
      <IconTile testID={`${testID}.icon`} icon={leading.icon} paint="pop" size="statHeader" />
    ) : (
      <LogoTile testID={`${testID}.logo`} logo={leading.logo} variant="statsHeader" />
    );
  return (
    <Panel testID={testID} gap={0}>
      <PanelHeader testID={`${testID}.title`} title={title} leading={start} />
      {children}
    </Panel>
  );
}
