// packages/shell/src/screens/premium/buy-button.tsx
import { useReportError } from '@demo/shell/services/error-log/use-report-error.ts';
import { PrimaryButton } from '@demo/shell/ui/primary-button.tsx';

export type BuyButtonProps = {
  readonly label: string;
  readonly isBusy: boolean;
  readonly onBuy: () => Promise<void>;
};

/** Spec S12 BUY button. The handler stays synchronous; failures reach the error log. */
export function BuyButton({ label, isBusy, onBuy }: BuyButtonProps): React.JSX.Element {
  const reportError = useReportError('purchase');
  const handlePress = (): void => {
    onBuy().catch(reportError);
  };
  return (
    <PrimaryButton
      label={label}
      isBusy={isBusy}
      testID="premium.buy-button"
      onPress={handlePress}
    />
  );
}
