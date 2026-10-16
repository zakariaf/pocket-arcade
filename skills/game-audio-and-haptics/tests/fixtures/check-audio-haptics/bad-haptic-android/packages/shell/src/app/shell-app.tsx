// packages/shell/src/app/shell-app.tsx
import { PressFeedbackProvider } from '@e07/shell/app/press-feedback-context.tsx';
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';
import { useAudioLifecycle } from '@e07/shell/services/audio/use-audio-lifecycle.ts';

import type { Services } from './services-context.tsx';
import type { ReactNode } from 'react';

type ShellAppProps = {
  readonly services: Services;
  readonly isFullscreenAdShowing: boolean;
  readonly children: ReactNode;
};

/** The composition root's component: mounts the audio lifecycle once and gives buttons their tap. */
export function ShellApp(props: ShellAppProps): ReactNode {
  useAudioLifecycle({
    audio: props.services.audio,
    isFullscreenAdShowing: props.isFullscreenAdShowing,
    reportError: (error) => props.services.errorLog.record('audio', error),
  });
  return (
    <PressFeedbackProvider onPress={() => playUiFeedback(props.services, 'tap')}>
      {props.children}
    </PressFeedbackProvider>
  );
}
