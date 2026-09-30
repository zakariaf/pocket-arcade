// packages/shell/src/screens/premium/restore-button.tsx
import { PrimaryButton } from '@demo/shell/ui/primary-button.tsx';

export type RestoreButtonProps = { readonly onRestore: () => Promise<void> };

/** Restore purchases. */
export function RestoreButton({ onRestore }: RestoreButtonProps): React.JSX.Element {
  const handleLongPress = async (): Promise<void> => {
    await onRestore();
  };
  return (
    <PrimaryButton
      testID="premium.restore-button"
      onLongPress={handleLongPress}
      onPress={async () => {
        await onRestore();
      }}
    />
  );
}
