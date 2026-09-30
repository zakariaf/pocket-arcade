import { Alert } from 'react-native';

export function confirmReset(): void {
  Alert.alert('Reset everything?', 'This cannot be undone.');
}
