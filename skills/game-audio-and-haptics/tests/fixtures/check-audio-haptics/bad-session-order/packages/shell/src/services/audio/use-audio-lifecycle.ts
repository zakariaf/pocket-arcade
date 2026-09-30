// packages/shell/src/services/audio/use-audio-lifecycle.ts
import { useEffect, useEffectEvent } from 'react';

import { useIsAppActive } from '@e07/shell/app/use-is-app-active.ts';

import type { AudioPort } from './audio-port.ts';

export type AudioLifecycleInput = {
  readonly audio: AudioPort;
  /** From the ads store: interstitials and rewarded ads play their own sound. */
  readonly isFullscreenAdShowing: boolean;
  /** `(error) => errorLog.record('audio', error)`: a failed suspend/resume is logged. */
  readonly reportError: (error: unknown) => void;
};

/** Mounted once in ShellApp: the AudioContext runs only while the app is visible and no ad plays. */
export function useAudioLifecycle(input: AudioLifecycleInput): void {
  const isAudible = useIsAppActive() && !input.isFullscreenAdShowing;
  const apply = useEffectEvent((isOn: boolean) => {
    const change = isOn ? input.audio.resume() : input.audio.suspend();
    change.catch(input.reportError);
  });
  useEffect(() => {
    apply(isAudible);
  }, [isAudible]);
}
