// packages/shell/src/app/parity/parity-scroll-marker.tsx
// Test builds only (reached through test-only.ts). The parity capture's measured scroll: the parity
// root hands renderParityScrollMarker to every ScreenBody (ScreenScrollMarkerContext), and a body
// draws it once it has scrolled, with the contentOffset its ScrollView reported. It is an invisible
// 1 x 1 pt accessible element whose testID is parity.scroll.<y> (hundredths of a point, "n" before a
// negative offset), so check-parity.mjs compares the offset the app really reached with the one the
// capture asked for, instead of inferring it from element shifts that a waived text-layout
// difference moves. Store builds never provide the context, so no body draws it or listens.
import { ParityMarker } from '@e07/shell/app/parity-marker.tsx';

import type { ReactNode } from 'react';

/** The marker's testID for an offset in points: parity.scroll.<whole>.<hundredths>. */
export function parityScrollTestID(y: number): string {
  const hundredths = Math.round(Math.abs(y) * 100);
  const sign = y < 0 && hundredths > 0 ? 'n' : '';
  const whole = Math.floor(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, '0');
  return `parity.scroll.${sign}${String(whole)}.${fraction}`;
}

type ParityScrollMarkerProps = {
  /** The offset, in points, that the body's ScrollView reported last (contentOffset.y). */
  readonly y: number;
};

/**
 * Draws the offset a ScreenBody reached as an invisible marker for the capture's hierarchy, in the
 * middle of the body (ParityMarker), clear of the system bars as the launch marker is.
 */
export function ParityScrollMarker({ y }: ParityScrollMarkerProps): ReactNode {
  const testID = parityScrollTestID(y);
  return <ParityMarker testID={testID} label={testID.slice('parity.scroll.'.length)} />;
}

/** What the parity root hands every ScreenBody through ScreenScrollMarkerContext. */
export function renderParityScrollMarker(y: number): ReactNode {
  return <ParityScrollMarker y={y} />;
}
