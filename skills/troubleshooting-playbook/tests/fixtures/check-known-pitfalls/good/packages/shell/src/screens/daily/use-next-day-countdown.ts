// packages/shell/src/screens/daily/use-next-day-countdown.ts (excerpt)
export function useNextDayCountdown(): Countdown {
  const { clock } = useServices();
  const minutesLeft = useSyncExternalStore(subscribeToTicks, () =>
    Math.ceil(clock.msUntilNextLocalDay() / 60_000),
  );
  return splitCountdown(minutesLeft * 60_000);
}
