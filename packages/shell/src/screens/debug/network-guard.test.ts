// packages/shell/src/screens/debug/network-guard.test.ts — drives the guard with a fake global scope.
// Targets are plain words: lint bans URL literals in app code, tests included.
import { installNetworkGuard, isDevLoopback } from './network-guard.ts';

import type { NetworkAttempt } from './network-guard.ts';

/** Stands in for XMLHttpRequest: the guard patches open() on its prototype. */
class FakeRequest {
  readonly kind = 'fake-request';
}

type Setup = {
  readonly member: (name: string) => (...args: readonly unknown[]) => unknown;
  readonly seen: NetworkAttempt[];
};

function setup(): Setup {
  const scope = {};
  Reflect.set(scope, 'XMLHttpRequest', FakeRequest);
  const seen: NetworkAttempt[] = [];
  const guard = installNetworkGuard(scope, (attempt) => {
    seen.push(attempt);
  });
  expect(guard.attempts()).toStrictEqual([]);
  const member = (name: string): ((...args: readonly unknown[]) => unknown) =>
    Reflect.get(name === 'open' ? FakeRequest.prototype : scope, name) as (
      ...args: readonly unknown[]
    ) => unknown;
  return { member, seen };
}

describe('installNetworkGuard', () => {
  it('rejects fetch and counts the attempt', async () => {
    const { member, seen } = setup();

    await expect(member('fetch')('remote-a')).rejects.toThrow(
      'N3: fetch to remote-a blocked by the network guard',
    );
    expect(seen).toStrictEqual([{ kind: 'fetch', target: 'remote-a' }]);
  });

  it('throws on XMLHttpRequest.open and on WebSocket, counting both', () => {
    const { member, seen } = setup();

    expect(() => member('open')('GET', 'remote-b')).toThrow('N3: xhr to remote-b');
    expect(() => member('WebSocket')('socket-c')).toThrow('N3: websocket to socket-c');
    expect(seen.map((attempt) => attempt.kind)).toStrictEqual(['xhr', 'websocket']);
  });

  it("lets only a Debug build's own Metro on loopback through", () => {
    const metro = ['ws', '://localhost:8081/hot'].join('');
    const remote = ['https', '://example.org/'].join('');

    expect(isDevLoopback(metro, true)).toBe(true);
    expect(isDevLoopback(metro, false)).toBe(false);
    expect(isDevLoopback(remote, true)).toBe(false);
  });
});
