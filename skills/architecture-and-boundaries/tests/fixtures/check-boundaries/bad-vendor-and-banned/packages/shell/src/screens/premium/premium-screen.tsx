// packages/shell/src/screens/premium/premium-screen.tsx
import { requestPurchase } from 'expo-iap';
import { useRouter } from 'expo-router';

/** Premium (S12). */
export function PremiumScreen(): unknown {
  return [requestPurchase, useRouter];
}
