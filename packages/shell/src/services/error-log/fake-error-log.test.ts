// packages/shell/src/services/error-log/fake-error-log.test.ts
import { createFakeErrorLog } from './fake-error-log.ts';

describe('createFakeErrorLog', () => {
  it('keeps every recorded error with its source and time', () => {
    const error = new Error('disk full');
    const log = createFakeErrorLog({ nowMs: () => 42 });
    log.record('save', error);

    expect(log.recorded).toStrictEqual([{ atMs: 42, source: 'save', error }]);
  });

  it('lists entries newest first with the message text', () => {
    const log = createFakeErrorLog();
    log.record('boot', new Error('first'));
    log.record('ads', 'second');

    expect(log.entries()).toStrictEqual([
      { atMs: 0, source: 'ads', message: 'second' },
      { atMs: 0, source: 'boot', message: 'first' },
    ]);
  });
});
