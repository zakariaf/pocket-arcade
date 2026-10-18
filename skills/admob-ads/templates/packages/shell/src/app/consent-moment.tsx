// packages/shell/src/app/consent-moment.tsx
// S3, the consent moment (spec S3, 8.8), mounted once in ShellFeatures around the navigator. It
// provides the ad hooks their moment and the live consent answer, and Settings its Ad privacy
// choices, and draws toybox-screens' ConsentIntroScreen full screen over the app while the flow
// asks for it: where Google's form is required, after the tutorial, online, not Premium, over a
// banner screen, before the first ad.
// The cover is a ModalLayer: VoiceOver stays on it, TalkBack cannot reach the app behind it, and
// the system back stays on S3. S3 has no Back control and is no route, so the back does nothing
// there (spec 5: the system back does what Back does); it never reaches the navigator under it.
import {
  AdPrivacyChoicesContext,
  ConsentMomentContext,
} from '@e07/shell/app/consent-moment-context.tsx';
import { ModalLayer } from '@e07/shell/app/modal-layer.tsx';
import { useConsentMoment } from '@e07/shell/app/use-consent-moment.ts';
import { ConsentIntroScreen } from '@e07/shell/screens/consent/consent-intro-screen.tsx';

import type { ConsentMomentOptions } from '@e07/shell/app/use-consent-moment.ts';
import type { ReactNode } from 'react';

export type ConsentMomentProps = ConsentMomentOptions & { readonly children: ReactNode };

/** The system back on S3: taken, and nothing happens. */
function stayOnConsent(): void {
  // S3 has no Back to mirror; the press is only kept from the navigator under the cover.
}

export function ConsentMoment({ children, ...options }: ConsentMomentProps): ReactNode {
  const model = useConsentMoment(options);
  return (
    <ConsentMomentContext value={model.value}>
      <ModalLayer
        behind={
          <AdPrivacyChoicesContext value={model.onOpenPrivacyOptions}>
            {children}
          </AdPrivacyChoicesContext>
        }
        layer={
          model.isIntroShown ? (
            <ConsentIntroScreen
              onContinue={model.onContinue}
              isReducedMotion={model.isReducedMotion}
            />
          ) : null
        }
        onBack={stayOnConsent}
      />
    </ConsentMomentContext>
  );
}
