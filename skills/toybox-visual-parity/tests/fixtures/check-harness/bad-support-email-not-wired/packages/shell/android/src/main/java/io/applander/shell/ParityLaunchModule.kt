// packages/shell/android/src/main/java/io/applander/shell/ParityLaunchModule.kt
package io.applander.shell

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The Android launch path of the parity harness (toybox-visual-parity). capture-app.mjs --platform
// android starts a test build with "am start -S -W -n <package>/.MainActivity --es parity <query>";
// this hands that string extra of the launch intent to JavaScript. Only app/parity/parity-launch-extra.ts
// asks for it, and only the test-only entry reaches that file, so a store build never reads it (as on
// iOS, where the -parity launch argument sits in NSUserDefaults unread).
class ParityLaunchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ParityLaunch")

    // The launch intent's string extra, or null (a normal start, or no activity yet).
    Function("getLaunchExtra") { key: String ->
      appContext.currentActivity?.intent?.getStringExtra(key)
    }
  }
}
