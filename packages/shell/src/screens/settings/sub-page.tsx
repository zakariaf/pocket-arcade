// packages/shell/src/screens/settings/sub-page.tsx
// The frame S11 and its pages S11a to S11d share: the screen scrolls on under the home indicator
// (UNDER_HOME_INDICATOR_EDGES and isUnderHomeIndicator), a top bar with the title and Back, then
// the common body with the page's block gap. testIDBase gives the design's <base>.screen and
// <base>.top-bar (whose parts .back-button and .title the TopBar derives); check-screens knows
// those four ids from the testIDBase a view passes (COMPONENT_IDS.SubPage).
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import type { ScreenBodyGap } from '@e07/shell/ui/screen-body.tsx';
import type { ReactNode } from 'react';

export type SubPageScope =
  'settings' | 'settings-language' | 'about' | 'privacy-policy' | 'licences';

export type SubPageProps = {
  readonly testIDBase: SubPageScope;
  /** Translated page title. */
  readonly title: string;
  /** Translated "Back" (common.back). */
  readonly backLabel: string;
  readonly onBack: () => void;
  readonly isReducedMotion: boolean;
  /** The body's block gap: Settings 20, Privacy policy and Licences 18, else 14. */
  readonly gap?: ScreenBodyGap;
  readonly children: ReactNode;
};

export function SubPage(props: SubPageProps): ReactNode {
  const { testIDBase, gap = 'default', children } = props;
  return (
    <ScreenFrame testID={`${testIDBase}.screen`} edges={UNDER_HOME_INDICATOR_EDGES}>
      <TopBar
        testID={`${testIDBase}.top-bar`}
        title={props.title}
        backLabel={props.backLabel}
        onBack={props.onBack}
        isReducedMotion={props.isReducedMotion}
      />
      <ScreenBody gap={gap} isUnderHomeIndicator>
        {children}
      </ScreenBody>
    </ScreenFrame>
  );
}
