import * as Updates from 'expo-updates';

export function restart(): Promise<void> {
  return Updates.reloadAsync();
}
