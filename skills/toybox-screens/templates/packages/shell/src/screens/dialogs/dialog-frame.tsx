// packages/shell/src/screens/dialogs/dialog-frame.tsx
import { ArtTile } from '@e07/shell/ui/art-tile.tsx';
import { DialogCard } from '@e07/shell/ui/dialog-card.tsx';
import { Scrim } from '@e07/shell/ui/scrim.tsx';

import type { ArtTileProps } from '@e07/shell/ui/art-tile.tsx';
import type { ReactNode } from 'react';

export type DialogArt = Pick<ArtTileProps, 'icon' | 'paint' | 'size'>;

export type DialogFrameProps = {
  /**
   * The dialog's testID scope, e.g. 'reset-progress-dialog'. The frame sets <scope>.scrim and
   * <scope>.art; DialogCard derives <scope>.card, <scope>.title and <scope>.body from it.
   */
  readonly scope: string;
  readonly art?: DialogArt;
  readonly title: string;
  readonly body: string;
  /** The buttons: a DialogButtonRow (safe choice at the start) or stacked block buttons. */
  readonly children: ReactNode;
};

/**
 * S14 dialog: the scrim over the screen underneath (which keeps its own testIDs; the scrim
 * centres the card 28 / 20 pt from the edges), the card (hard shadow 8), then art, title, body
 * and buttons. Never a banner or a sticker here.
 */
export function DialogFrame({ scope, art, title, body, children }: DialogFrameProps): ReactNode {
  return (
    <Scrim testID={`${scope}.scrim`}>
      <DialogCard
        testIDBase={scope}
        title={title}
        body={body}
        {...(art === undefined ? {} : { art: <ArtTile testID={`${scope}.art`} {...art} /> })}
      >
        {children}
      </DialogCard>
    </Scrim>
  );
}
