// packages/shell/ios/BoardFontModule.swift
import ExpoModulesCore
import Foundation

public class BoardFontModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BoardFont")
    // The bytes of a font the expo-font config plugin bundled (the app bundle's root), or nil.
    // The board makes its digits face from them (board-number-typeface.ts), the same way as on
    // Android, where Skia's font manager cannot see the app's fonts at all.
    Function("readFontBytes") { (fileName: String) -> Data? in
      guard let url = Bundle.main.url(forResource: fileName, withExtension: nil) else { return nil }
      return try? Data(contentsOf: url)
    }
  }
}
