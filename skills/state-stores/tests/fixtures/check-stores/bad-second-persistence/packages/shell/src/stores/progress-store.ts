import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist } from 'zustand/middleware';

export const STORAGE = { AsyncStorage, persist };
