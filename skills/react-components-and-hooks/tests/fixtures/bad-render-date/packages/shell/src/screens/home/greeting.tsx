import type { ReactNode } from 'react';

export function Greeting(): ReactNode {
  const hour = Date.now() % 24;
  return hour;
}
