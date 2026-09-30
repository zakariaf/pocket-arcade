// packages/shell/src/app/press-feedback-context.tsx
// How a button press sounds, without every button reaching for the services: ShellApp provides it
// once; the Pressable hosts (RaisedSurface, QuietButton, ListRow) read it with usePressFeedback and
// run it on press (a switch row plays the toggle feedback instead). It lives in app/ because ui/
// may not import services/ (ESLint's ui boundary): this file imports only React, so ui/ reads it
// directly and there is exactly one press-feedback context in the Shell.
import { createContext, use } from 'react';

import type { ReactNode } from 'react';

/** Silent by default, so component tests without the provider need no audio fake. */
const PressFeedbackContext = createContext<() => void>(() => undefined);

export type PressFeedbackProviderProps = {
  /** ShellApp passes () => { playUiFeedback(services, 'tap'); }. */
  readonly onPress: () => void;
  readonly children: ReactNode;
};

export function PressFeedbackProvider(props: PressFeedbackProviderProps): ReactNode {
  return <PressFeedbackContext value={props.onPress}>{props.children}</PressFeedbackContext>;
}

/** The feedback to run on every button press (a no-op outside the provider). */
export function usePressFeedback(): () => void {
  return use(PressFeedbackContext);
}
