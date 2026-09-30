import { daysBetween } from '@e07/game-kit/dates/date-key.ts';
import { useState } from 'react';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

type Clock = { readonly today: () => string };

export function useStreakText(daily: SaveDoc['daily'], clock: Clock): number {
  const [today] = useState(() => clock.today());
  const last = daily.streak.lastDate;
  return last !== null && daysBetween(last, today) <= 1 ? daily.streak.length : 0;
}
