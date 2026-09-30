// packages/shell/src/app/perf/process-start.ts
// device-only: covered by the simulator cold-start run (check-perf-report.mjs reads the nativeMs it measures)
import { requireOptionalNativeModule } from 'expo';

type ProcessStartModule = { getProcessStartEpochMs(): number };

// Native side: packages/shell/ios/ProcessStartModule.swift (sysctl KERN_PROC_PID p_starttime).
const nativeModule = requireOptionalNativeModule<ProcessStartModule>('ProcessStart');

/** Wall-clock start of this process, or null (Jest, Android until ported, sysctl failure). */
export function readProcessStartEpochMs(): number | null {
  const value = nativeModule?.getProcessStartEpochMs();
  return value === undefined || value < 0 ? null : value;
}
