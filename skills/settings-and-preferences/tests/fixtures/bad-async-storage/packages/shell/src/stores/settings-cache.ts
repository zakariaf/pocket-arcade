import AsyncStorage from '@react-native-async-storage/async-storage';

export async function cacheTheme(theme: string): Promise<void> {
  await AsyncStorage.setItem('theme', theme);
}
