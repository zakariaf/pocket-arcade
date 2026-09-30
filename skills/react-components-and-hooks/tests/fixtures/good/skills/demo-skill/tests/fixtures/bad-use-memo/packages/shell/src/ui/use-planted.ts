// planted: the skill library's fixtures are skipped (REPO_SCAN_IGNORES)
import { useMemo } from 'react';

export function usePlanted(): number {
  return useMemo(() => 1, []);
}
