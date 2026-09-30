// Fixture: the one file that imports expo-haptics.
import * as Haptics from 'expo-haptics';

export function pulse(): void {
  void Haptics.selectionAsync();
}
