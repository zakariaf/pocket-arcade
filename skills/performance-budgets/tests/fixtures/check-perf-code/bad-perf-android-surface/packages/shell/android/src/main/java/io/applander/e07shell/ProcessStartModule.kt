// packages/shell/android/src/main/java/io/applander/e07shell/ProcessStartModule.kt
package io.applander.e07shell

import android.os.Process
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ProcessStartModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ProcessStart")
    // Planted bug: another function name than the Swift module's (and the raw uptime), so
    // process-start.ts finds no getProcessStartEpochMs on Android.
    Function("getStartUptimeMs") {
      Process.getStartUptimeMillis().toDouble()
    }
  }
}
