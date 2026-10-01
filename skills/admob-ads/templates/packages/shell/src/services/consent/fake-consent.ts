// packages/shell/src/services/consent/fake-consent.ts
import type { ConsentInfo, ConsentPort, TrackingStatus } from './consent-port.ts';

export type FakeConsentScript = {
  afterRefresh: ConsentInfo;
  afterForm: ConsentInfo;
  /** The ATT status at the start (default 'unavailable', as with ads off: nothing is asked). */
  readonly tracking?: TrackingStatus;
  /** The player's answer when the fake asks, that is while the status is 'not-determined'. */
  readonly trackingAnswer?: TrackingStatus;
  readonly calls: string[];
};

export type FakeConsent = ConsentPort & {
  /** How many times the fake showed the system ATT prompt (Apple asks once, then never again). */
  readonly trackingPrompts: () => number;
};

export function createFakeConsent(script: FakeConsentScript): FakeConsent {
  let tracking = script.tracking ?? 'unavailable';
  let prompts = 0;
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
    // Like the adapter: the prompt only while not-determined, then the answer sticks.
    requestTracking: () => {
      script.calls.push('requestTracking');
      if (tracking === 'not-determined') {
        prompts += 1;
        tracking = script.trackingAnswer ?? 'denied';
      }
      return Promise.resolve(tracking);
    },
    trackingPrompts: () => prompts,
  };
}
