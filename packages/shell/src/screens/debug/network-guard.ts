// packages/shell/src/screens/debug/network-guard.ts
// TEST VARIANT ONLY: reachable only through TEST_ONLY (packages/shell/src/app/test-only.ts).
// Counts and blocks every JS-level network attempt so E2E can assert "network attempts: 0".
// It cannot see native SDK traffic (AdMob, StoreKit): the lsof runtime layer covers that.
export type NetworkAttempt = {
  readonly kind: 'fetch' | 'xhr' | 'websocket';
  readonly target: string;
};
export type NetworkGuard = { readonly attempts: () => readonly NetworkAttempt[] };

// A Debug build (the StoreKit harness) talks to its own Metro on loopback: the bundle and the HMR
// websocket. Loopback is not network traffic (the lsof layer allows it too); a Release build has
// __DEV__ false, so it still blocks everything.
const LOOPBACK = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/;

/** @public The one exception: a Debug build's own Metro on loopback. */
export const isDevLoopback = (target: unknown, isDev: boolean = __DEV__): boolean =>
  isDev && LOOPBACK.test(String(target));

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
  const realFetch: unknown = Reflect.get(scope, 'fetch');
  Reflect.set(scope, 'fetch', (input: unknown, ...rest: unknown[]) =>
    isDevLoopback(input) && typeof realFetch === 'function'
      ? (Reflect.apply(realFetch, scope, [input, ...rest]) as unknown)
      : Promise.reject(record({ kind: 'fetch', target: String(input) })),
  );
  const xhr: unknown = Reflect.get(scope, 'XMLHttpRequest');
  if (typeof xhr === 'function') {
    const proto = xhr.prototype as object;
    const realOpen: unknown = Reflect.get(proto, 'open');
    Reflect.set(proto, 'open', function guardedOpen(this: object, ...args: unknown[]) {
      if (isDevLoopback(args[1]) && typeof realOpen === 'function') {
        return Reflect.apply(realOpen, this, args) as unknown;
      }
      throw record({ kind: 'xhr', target: String(args[1]) });
    });
  }
  const realWebSocket: unknown = Reflect.get(scope, 'WebSocket');
  Reflect.set(scope, 'WebSocket', function blockedWebSocket(url: unknown, ...rest: unknown[]) {
    if (isDevLoopback(url) && typeof realWebSocket === 'function') {
      return Reflect.construct(realWebSocket, [url, ...rest]) as object;
    }
    throw record({ kind: 'websocket', target: String(url) });
  });
  return { attempts: () => seen };
}
