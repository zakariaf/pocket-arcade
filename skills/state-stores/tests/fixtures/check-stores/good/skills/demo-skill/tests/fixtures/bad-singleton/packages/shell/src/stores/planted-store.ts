// planted: the skill library's fixtures are skipped (REPO_SCAN_IGNORES)
import { create } from 'zustand';

export const usePlantedStore = create(() => ({ count: 0 }));
