// packages/shell/src/app/perf/process-start.ts
// device-only: covered by the simulator and emulator cold-start runs (check-perf-report.mjs reads the nativeMs they measure)
import { requireOptionalNativeModule } from 'expo';

/** The Expo module ProcessStart, the same surface on both platforms. */
type ProcessStartModule = { getProcessStartEpochMs(): number };

// Native side: packages/shell/ios/ProcessStartModule.swift (sysctl KERN_PROC_PID p_starttime) and
// packages/shell/android/.../ProcessStartModule.kt (Process.getStartUptimeMillis()).
const nativeModule = requireOptionalNativeModule<ProcessStartModule>('ProcessStart');

/** The module's reading of the process start in epoch ms, or null (no module, or a failed read: -1). */
export function processStartFrom(module: ProcessStartModule | null): number | null {
  const value = module?.getProcessStartEpochMs();
  return value === undefined || value < 0 ? null : value;
}

/** Wall-clock start of this process, or null (Jest, a build without the native module, a failed read). */
export function readProcessStartEpochMs(): number | null {
  return processStartFrom(nativeModule);
}
