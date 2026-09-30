// packages/shell/src/game-host/use-board-clock.ts
/** A hook may name the callbacks it wires into a worklet after their slot (onDone). */
export function useBoardClock(stop: () => void): { readonly onDone: () => void } {
  const onDone = (): void => {
    stop();
  };
  return { onDone };
}
