import { ModalLayer } from '@e07/shell/app/modal-layer.tsx';

import type { ReactNode } from 'react';

export type GameLayoutProps = { readonly board: ReactNode; readonly overlay: ReactNode | null };

// The overlay is drawn in the ModalLayer, which hides the board behind it from TalkBack.
export function GameLayout({ board, overlay }: GameLayoutProps): ReactNode {
  return <ModalLayer behind={board} layer={overlay} />;
}
