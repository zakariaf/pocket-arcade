// packages/shell/src/app/parity/parity-root.tsx
// Test builds only (reached through test-only.ts). Wraps the Shell's root in the four contexts the
// product code offers the harness, so no screen or component imports test-only code: the banner
// placements forced open (useAdContext), the scroll offset of a tall frame and the marker that shows
// the offset a body really reached (ScreenBody: parity.scroll.<y>, which check-parity measures the
// scroll by) and this launch's nonce (ParityLaunchMarker). The root draws the marker parity.launch.<nonce> itself; a
// modal layer (the Scrim, the Result overlay, the consent cover) hides everything outside it from
// the accessibility tree, so each modal root draws a ParityLaunchMarker too.
import { ParityLaunchContext, ParityLaunchMarker } from '@e07/shell/app/parity-launch-marker.tsx';
import { ForcedAdPlacementsContext } from '@e07/shell/app/use-ad-context.ts';
import {
  ScreenScrollMarkerContext,
  ScreenScrollTargetContext,
} from '@e07/shell/ui/screen-body.tsx';

import { parityForcedPlacements } from './parity-ads.tsx';
import { renderParityScrollMarker } from './parity-scroll-marker.tsx';

import type { ParityRequest } from './parity-request.ts';
import type { ReactNode } from 'react';

export type ParityFrameRootProps = {
  readonly request: ParityRequest;
  readonly children: ReactNode;
};

export function ParityFrameRoot({ request, children }: ParityFrameRootProps): ReactNode {
  // 0 means the top: leave ScreenBody's own default in charge.
  const scrollY = request.scrollY > 0 ? request.scrollY : undefined;
  return (
    <ParityLaunchContext value={request.nonce ?? null}>
      <ForcedAdPlacementsContext value={parityForcedPlacements(request.plan)}>
        <ScreenScrollTargetContext value={scrollY}>
          <ScreenScrollMarkerContext value={renderParityScrollMarker}>
            {children}
            <ParityLaunchMarker />
          </ScreenScrollMarkerContext>
        </ScreenScrollTargetContext>
      </ForcedAdPlacementsContext>
    </ParityLaunchContext>
  );
}
