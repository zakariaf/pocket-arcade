// packages/shell/src/screens/premium/buy-button.tsx
import { useReportError } from '@e07/shell/services/error-log/use-report-error.ts';
import { Button } from '@e07/shell/ui/button.tsx';

export type BuyButtonProps = {
  readonly label: string;
  readonly isBusy: boolean;
  /** From useReduceMotion() in the screen model. */
  readonly isReducedMotion: boolean;
  readonly onBuy: () => Promise<void>;
};

/** Spec S12 BUY button. The handler stays synchronous; failures reach the error log. */
export function BuyButton({
  label,
  isBusy,
  isReducedMotion,
  onBuy,
}: BuyButtonProps): React.JSX.Element {
  const reportError = useReportError('purchase');
  const handlePress = (): void => {
    onBuy().catch(reportError);
  };
  return (
    <Button
      label={label}
      kind="primary"
      size="hero"
      isBusy={isBusy}
      isReducedMotion={isReducedMotion}
      testID="premium.buy-button"
      onPress={handlePress}
    />
  );
}
