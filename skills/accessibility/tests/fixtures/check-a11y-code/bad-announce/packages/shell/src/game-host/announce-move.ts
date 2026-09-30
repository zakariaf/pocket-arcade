import { AccessibilityInfo } from 'react-native';

export function announceMove(text: string): void {
  AccessibilityInfo.announceForAccessibility(text);
}
