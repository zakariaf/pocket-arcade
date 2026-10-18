// packages/shell/src/app/debug-link-intake.ts
// Test builds only (the link handler's inbox). React Native's Linking delivers a link once: as
// the launch URL (getInitialURL) or as a 'url' event to the listeners attached at that moment.
// A flow opens its first link right after launchApp, while the app is still starting, so the
// handler listens from createDebugParts on (listen) and queues every link until the navigator is
// ready (start, from NavigationRoot's onReady); then it applies them in the order they came.

/** What React Native's Linking offers (a fake in tests). */
export type LinkSource = {
  readonly getInitialURL: () => Promise<string | null | undefined>;
  readonly addEventListener: (
    type: 'url',
    listener: (event: { readonly url: string }) => void,
  ) => { readonly remove: () => void };
};

export type LinkIntakeDeps = {
  /** The handler: applies one link (the navigator is ready). */
  readonly onUrl: (url: string) => unknown;
  readonly onError: (error: unknown) => void;
};

export type StartOptions = {
  /** The launch URL to drop: the link a direction reload was for was applied before the reload. */
  readonly skipLaunchUrl: string | null;
  /** Runs first, once ready (the handler opens the screen a reload was for). */
  readonly onReady: () => void;
};

export type LinkIntake = {
  /** Listens now; links wait in a queue until start(). Returns the unsubscribe. */
  readonly listen: (links: LinkSource) => () => void;
  /** Ready: onReady, then the queue in order. The returned stop queues links again. */
  readonly start: (links: LinkSource, options: StartOptions) => () => void;
};

type Incoming = { readonly url: string; readonly isLaunch: boolean };
type Subscription = { readonly remove: () => void };

export function createLinkIntake(deps: LinkIntakeDeps): LinkIntake {
  const queue: Incoming[] = [];
  let isReady = false;
  let skipLaunchUrl: string | null = null;
  let subscription: Subscription | null = null;
  const receive = (incoming: Incoming): void => {
    if (!isReady) queue.push(incoming);
    else if (!(incoming.isLaunch && incoming.url === skipLaunchUrl)) deps.onUrl(incoming.url);
  };
  const unsubscribe = (): void => {
    subscription?.remove();
    subscription = null;
  };
  const listen = (links: LinkSource): (() => void) => {
    if (subscription !== null) return unsubscribe;
    subscription = links.addEventListener('url', (event) => {
      receive({ url: event.url, isLaunch: false });
    });
    links
      .getInitialURL()
      .then((url) => {
        if (typeof url === 'string') receive({ url, isLaunch: true });
      })
      .catch(deps.onError);
    return unsubscribe;
  };
  const start = (links: LinkSource, options: StartOptions): (() => void) => {
    const isOwnSubscription = subscription === null;
    if (isOwnSubscription) listen(links);
    skipLaunchUrl = options.skipLaunchUrl;
    isReady = true;
    options.onReady();
    for (const incoming of queue.splice(0)) receive(incoming);
    return () => {
      isReady = false;
      if (isOwnSubscription) unsubscribe();
    };
  };
  return { listen, start };
}
