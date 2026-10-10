// packages/shell/src/screens/settings/privacy/privacy-policy-screen.tsx
// device-only: covered by the S11c parity capture on the simulator; a route file only joins its model hook and its view, which have their own tests.
import { PrivacyPolicyView } from './privacy-policy-view.tsx';
import { usePrivacyPolicyModel } from './use-privacy-policy-model.ts';

import type { ReactNode } from 'react';

/** Route PrivacyPolicy (S11c): the policy as offline text. */
export function PrivacyPolicyScreen(): ReactNode {
  const model = usePrivacyPolicyModel();
  return <PrivacyPolicyView model={model} />;
}
