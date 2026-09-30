// packages/shell/src/screens/home/use-home-model.ts (fixture: the lines the e2e setup check reads)
import { useOptionalDebugServices } from '@e07/shell/app/debug-services-context.tsx';
import { useColdStartMark } from '@e07/shell/app/perf/use-cold-start-mark.ts';

export function useHomeModel(): void {
  useColdStartMark(null);
}
