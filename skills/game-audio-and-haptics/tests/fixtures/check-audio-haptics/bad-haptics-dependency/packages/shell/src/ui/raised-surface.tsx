// packages/shell/src/ui/raised-surface.tsx
import { usePressFeedback } from '@e07/shell/app/press-feedback-context.tsx';

/** Every Toybox button presses through here, so every press sounds ui.tap. */
export function useRaisedPress(onPress: () => void): () => void {
  const onPressFeedback = usePressFeedback();
  return () => {
    onPressFeedback();
    onPress();
  };
}
