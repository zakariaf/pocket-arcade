// packages/shell/src/stores/premium/premium-nudge.ts
// The one quiet Premium line on the Result screen (spec S7/S12: never a pop-up, at most once a
// day, never for owners). Pure: the caller reads the save's upsell.lastShownOn and, once the line
// was shown, writes today into it (a local 'YYYY-MM-DD' day key from ClockPort).
export type NudgeInput = {
  readonly isPremium: boolean;
  readonly priceText: string | null; // priceOf(flow): no store price, no line
  readonly lastShownOn: string | null; // the save's upsell.lastShownOn
  readonly today: string; // local day key, 'YYYY-MM-DD'
};

/** The price text for "Enjoying it? Remove ads for {priceText}.", or null for no line today. */
export function premiumNudgePrice(input: NudgeInput): string | null {
  if (input.isPremium || input.priceText === null) return null;
  return input.lastShownOn === input.today ? null : input.priceText;
}
