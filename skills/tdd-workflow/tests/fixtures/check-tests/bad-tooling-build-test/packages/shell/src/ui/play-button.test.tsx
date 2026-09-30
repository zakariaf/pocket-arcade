// packages/shell/src/ui/play-button.test.tsx
import { dayKey } from '@e07/shell/services/clock/day-key.ts';

describe('PlayButton', () => {
  it('shows the day key', () => {
    expect(dayKey(86_400_000)).toBe(1);
  });
});
