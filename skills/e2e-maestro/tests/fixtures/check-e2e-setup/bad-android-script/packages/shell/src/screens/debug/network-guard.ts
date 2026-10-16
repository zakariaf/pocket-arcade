// packages/shell/src/screens/debug/network-guard.ts
// TEST VARIANT ONLY: reachable only through TEST_ONLY (packages/shell/src/app/test-only.ts).
// Counts and blocks every JS-level network attempt so E2E can assert "network attempts: 0".
// It cannot see native SDK traffic (AdMob, StoreKit): the lsof runtime layer covers that.
export type NetworkAttempt = {
  readonly kind: 'fetch' | 'xhr' | 'websocket';
  readonly target: string;
};
export type NetworkGuard = { readonly attempts: () => readonly NetworkAttempt[] };

function blockedError(attempt: NetworkAttempt): Error {
  return new Error(`N3: ${attempt.kind} to ${attempt.target} blocked by the network guard`);
}

export function installNetworkGuard(
  scope: object,
  onAttempt: (a: NetworkAttempt) => void,
): NetworkGuard {
  const seen: NetworkAttempt[] = [];
  const record = (attempt: NetworkAttempt): Error => {
    seen.push(attempt);
    onAttempt(attempt); // ErrorLogPort: visible in the debug menu
    return blockedError(attempt);
  };
  Reflect.set(scope, 'fetch', (input: unknown) =>
    Promise.reject(record({ kind: 'fetch', target: String(input) })),
  );
  const xhr: unknown = Reflect.get(scope, 'XMLHttpRequest');
  if (typeof xhr === 'function') {
    Reflect.set(xhr.prototype as object, 'open', (_method: string, url: unknown) => {
      throw record({ kind: 'xhr', target: String(url) });
    });
  }
  Reflect.set(scope, 'WebSocket', function blockedWebSocket(url: unknown): never {
    throw record({ kind: 'websocket', target: String(url) });
  });
  return { attempts: () => seen };
}
