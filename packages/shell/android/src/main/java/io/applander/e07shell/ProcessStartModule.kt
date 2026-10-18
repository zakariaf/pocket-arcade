// packages/shell/android/src/main/java/io/applander/e07shell/ProcessStartModule.kt
package io.applander.e07shell

import android.os.Process
import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ProcessStartModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ProcessStart")
    // Wall-clock start of this process in epoch milliseconds: the time since the process started
    // (Process.getStartUptimeMillis, API 24+) taken back from the wall clock now.
    Function("getProcessStartEpochMs") {
      val sinceStartMs = SystemClock.uptimeMillis() - Process.getStartUptimeMillis()
      (System.currentTimeMillis() - sinceStartMs).toDouble()
    }
  }
}
