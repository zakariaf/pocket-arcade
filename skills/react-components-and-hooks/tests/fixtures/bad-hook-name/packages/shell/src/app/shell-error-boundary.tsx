// packages/shell/src/app/shell-error-boundary.tsx
// The ONLY class component in the codebase: React 19 has no hook for error boundaries.
import { Component } from 'react';

import type { ErrorInfo, ReactNode } from 'react';

export type ShellErrorBoundaryProps = {
  readonly children: ReactNode;
  /** Writes to ErrorLogPort (local only, spec 8.14). Must not throw. */
  readonly onError: (error: unknown, componentStack: string) => void;
  readonly renderFallback: (reset: () => void) => ReactNode;
};

type BoundaryState = { readonly hasError: boolean };

export class ShellErrorBoundary extends Component<ShellErrorBoundaryProps, BoundaryState> {
  override state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError(error, info.componentStack ?? '');
  }

  private readonly reset = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    return this.state.hasError ? this.props.renderFallback(this.reset) : this.props.children;
  }
}
