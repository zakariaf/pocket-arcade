// A hook store created at module level: one instance shared by every test and app start.
import { create } from 'zustand';

type SettingsState = { readonly theme: 'system' | 'light' | 'dark' };

export const useSettingsStore = create<SettingsState>()(() => ({ theme: 'system' }));
