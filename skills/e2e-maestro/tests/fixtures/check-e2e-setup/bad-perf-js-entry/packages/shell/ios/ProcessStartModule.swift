// packages/shell/ios/ProcessStartModule.swift
import Darwin
import ExpoModulesCore

public class ProcessStartModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ProcessStart")
    // Wall-clock start time of this process in epoch milliseconds (sysctl KERN_PROC_PID).
    Function("getProcessStartEpochMs") { () -> Double in
      var info = kinfo_proc()
      var size = MemoryLayout<kinfo_proc>.stride
      var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
      guard sysctl(&mib, u_int(mib.count), &info, &size, nil, 0) == 0 else { return -1 }
      let start = info.kp_proc.p_starttime
      return Double(start.tv_sec) * 1000 + Double(start.tv_usec) / 1000
    }
  }
}
