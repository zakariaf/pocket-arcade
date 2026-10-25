// packages/shell/android/src/main/java/io/applander/e07shell/BoardFontModule.kt
package io.applander.e07shell

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException

class BoardFontModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BoardFont")
    // The bytes of a font the expo-font config plugin bundled (the APK's assets/fonts/), or null.
    // Skia's Android font manager reads only /system/fonts, so the board makes its digits face
    // from these bytes (board-number-typeface.ts); asking it for 'Vazirmatn' drew blank numbers.
    Function("readFontBytes") { fileName: String ->
      val assets = appContext.reactContext?.assets ?: return@Function null
      try {
        assets.open("fonts/$fileName").use { it.readBytes() }
      } catch (error: IOException) {
        null
      }
    }
  }
}
