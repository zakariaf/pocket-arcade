// packages/shell/src/app/parity-launch-marker.tsx
// The parity capture's proof that a Maestro hierarchy dump came from this launch. Reached in every
// build (the ModalLayer renders it), yet it draws nothing unless the test-only parity root provides a
// nonce: store builds never provide one. With a nonce it renders an invisible 1 x 1 pt accessible
// element whose testID is parity.launch.<nonce>; capture-app.mjs refuses a dump without it
// ("hierarchy from another simulator"). A modal layer hides everything outside it from the
// accessibility tree, so the ModalLayer renders one inside its layer (the consent cover, the dialogs,
// Pause and Result: one per layer, never again in the Scrim or the Result overlay inside it), and the
// parity root renders one for every other frame.
import { createContext, use } from 'react';

import { ParityMarker } from './parity-marker.tsx';

import type { ReactNode } from 'react';

/** This launch's nonce (from the -parity launch argument), or null outside a parity capture. */
export const ParityLaunchContext = createContext<string | null>(null);

/** The marker's testID for a nonce: parity.launch.<nonce>. */
export function parityLaunchTestID(nonce: string): string {
  return `parity.launch.${nonce}`;
}

/** Renders the invisible nonce marker in a parity capture, and nothing otherwise. */
export function ParityLaunchMarker(): ReactNode {
  const nonce = use(ParityLaunchContext);
  if (nonce === null) return null;
  return <ParityMarker testID={parityLaunchTestID(nonce)} label={nonce} />;
}
