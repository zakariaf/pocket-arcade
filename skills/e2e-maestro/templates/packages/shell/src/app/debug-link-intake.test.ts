// packages/shell/src/app/debug-link-intake.test.ts
// The debug link's inbox: links that arrive while the app is still starting wait for the
// navigator, in order, and none is applied twice or lost.
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { createLinkIntake } from './debug-link-intake.ts';

import type { LinkSource } from './debug-link-intake.ts';

type FakeLinks = LinkSource & {
  readonly open: (url: string) => void;
  readonly listeners: () => number;
};

function fakeLinks(initialUrl: string | null): FakeLinks {
  const listeners = new Set<(event: { readonly url: string }) => void>();
  return {
    getInitialURL: () => Promise.resolve(initialUrl),
    addEventListener: (_type, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    open: (url) => {
      listeners.forEach((listener) => {
        listener({ url });
      });
    },
    listeners: () => listeners.size,
  };
}

function setup() {
  const applied: string[] = [];
  const errors: unknown[] = [];
  const intake = createLinkIntake({
    onUrl: (url) => applied.push(url),
    onError: (error) => errors.push(error),
  });
  return { intake, applied, errors };
}

const READY = { skipLaunchUrl: null, onReady: () => undefined };

describe('createLinkIntake', () => {
  it('keeps the launch link and early links until the navigator is ready, in order', async () => {
    const { intake, applied } = setup();
    const links = fakeLinks('launch');
    intake.listen(links);
    links.open('early');
    await flushMicrotasks();
    expect(applied).toStrictEqual([]);

    const order: string[] = [];
    intake.start(links, { skipLaunchUrl: null, onReady: () => order.push('ready') });
    links.open('later');

    expect(order).toStrictEqual(['ready']);
    expect(applied).toStrictEqual(['early', 'launch', 'later']);
    expect(links.listeners()).toBe(1);
  });

  it('drops only the launch link a direction reload was already for', async () => {
    const { intake, applied } = setup();
    const links = fakeLinks('reload-link');
    intake.listen(links);
    await flushMicrotasks();
    intake.start(links, { skipLaunchUrl: 'reload-link', onReady: () => undefined });
    links.open('reload-link');
    expect(applied).toStrictEqual(['reload-link']);
  });

  it('listens from start() when nothing listened before, and stops with it', async () => {
    const { intake, applied } = setup();
    const links = fakeLinks('launch');
    const stop = intake.start(links, READY);
    await flushMicrotasks();
    links.open('next');
    stop();
    links.open('after-stop');
    expect(applied).toStrictEqual(['launch', 'next']);
    expect(links.listeners()).toBe(0);
  });

  it('queues again while the navigator is gone, and keeps the early subscription', () => {
    const { intake, applied } = setup();
    const links = fakeLinks(null);
    const unsubscribe = intake.listen(links);
    const stop = intake.start(links, READY);
    stop();
    links.open('while-remounting');
    expect(applied).toStrictEqual([]);
    intake.start(links, READY);
    expect(applied).toStrictEqual(['while-remounting']);
    expect(intake.listen(links)).toBe(unsubscribe);
    unsubscribe();
    expect(links.listeners()).toBe(0);
  });

  it('records a failing launch-link read', async () => {
    const { intake, errors } = setup();
    intake.listen({
      getInitialURL: () => Promise.reject(new Error('no launch url')),
      addEventListener: () => ({ remove: () => undefined }),
    });
    await flushMicrotasks();
    expect(errors).toStrictEqual([new Error('no launch url')]);
  });
});
