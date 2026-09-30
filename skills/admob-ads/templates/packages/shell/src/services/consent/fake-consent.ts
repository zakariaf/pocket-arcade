// packages/shell/src/services/consent/fake-consent.ts
import type { ConsentInfo, ConsentPort } from './consent-port.ts';

export type FakeConsentScript = {
  afterRefresh: ConsentInfo;
  afterForm: ConsentInfo;
  readonly calls: string[];
};

export function createFakeConsent(script: FakeConsentScript): ConsentPort {
  return {
    refresh: () => {
      script.calls.push('refresh');
      return Promise.resolve(script.afterRefresh);
    },
    showFormIfRequired: () => {
      script.calls.push('showFormIfRequired');
      return Promise.resolve(script.afterForm);
    },
    showPrivacyOptions: () => {
      script.calls.push('showPrivacyOptions');
      return Promise.resolve(script.afterForm);
    },
  };
}
