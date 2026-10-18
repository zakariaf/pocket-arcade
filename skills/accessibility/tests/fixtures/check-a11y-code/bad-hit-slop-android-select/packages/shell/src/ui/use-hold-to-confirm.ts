// The hook itself: its callers (hold-button.tsx) provide the screen-reader alternative.
export function useHoldToConfirm(onConfirm: () => void): { readonly handlePressIn: () => void; readonly handlePressOut: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    handlePressIn: () => {
      timer = setTimeout(onConfirm, 2000);
    },
    handlePressOut: () => {
      if (timer !== null) clearTimeout(timer);
    },
  };
}
