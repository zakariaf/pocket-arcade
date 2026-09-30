// packages/shell/src/screens/daily/daily-next-in.ts
// Planted bug: "time to midnight" from epoch time is UTC midnight, not the player's.
import { useServices } from '@e07/shell/app/services-context.tsx';

export function useNextIn(): { readonly hours: number; readonly minutes: number } {
  const { clock } = useServices();
  const left = 86_400_000 - (clock.nowMs() % 86_400_000);
  return { hours: Math.floor(left / 3_600_000), minutes: Math.floor((left % 3_600_000) / 60_000) };
}
