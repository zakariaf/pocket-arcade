// packages/shell/src/app/parity/parity-root.test.tsx
// no-shell-context: ParityFrameRoot provides its own contexts and reads nothing else from the Shell.
import { render, screen } from '@testing-library/react-native';
import { use } from 'react';
import { View } from 'react-native';

import { ForcedAdPlacementsContext } from '@e07/shell/app/use-ad-context.ts';
import { ScreenScrollTargetContext } from '@e07/shell/ui/screen-body.tsx';

import { PARITY_PLANS } from './parity-plans.ts';
import { ParityFrameRoot } from './parity-root.tsx';

import type { ParityFrameKey } from './parity-plans.ts';
import type { ParityRequest } from './parity-request.ts';
import type { ReactNode } from 'react';

function requestFor(frame: ParityFrameKey, scrollY: number): ParityRequest {
  return {
    frame,
    plan: PARITY_PLANS[frame],
    theme: 'light',
    lang: 'en',
    game: 'lineSiege',
    date: '2026-09-27',
    scrollY,
  };
}

/** Reports what the two harness contexts hold, as its accessibility label. */
function ContextProbe(): ReactNode {
  const placements = use(ForcedAdPlacementsContext);
  const scrollY = use(ScreenScrollTargetContext);
  return (
    <View testID="parity.probe" accessibilityLabel={`${placements.join(',')}|${String(scrollY)}`} />
  );
}

describe('ParityFrameRoot', () => {
  it('forces the banner slots open and passes the scroll offset of a tall frame', async () => {
    await render(
      <ParityFrameRoot request={requestFor('s11-settings', 573)}>
        <ContextProbe />
      </ParityFrameRoot>,
    );

    expect(screen.getByTestId('parity.probe')).toHaveProp(
      'accessibilityLabel',
      'home,levels,stats,result|573',
    );
  });

  it('leaves Premium frames without banners and the top of the page to ScreenBody', async () => {
    await render(
      <ParityFrameRoot request={requestFor('s4-home-premium', 0)}>
        <ContextProbe />
      </ParityFrameRoot>,
    );

    expect(screen.getByTestId('parity.probe')).toHaveProp('accessibilityLabel', '|undefined');
  });
});
