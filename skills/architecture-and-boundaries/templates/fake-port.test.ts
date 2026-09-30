// packages/shell/src/services/__PORT_FOLDER__/fake-__PORT_FOLDER__.test.ts
import { createFake__PORT_NAME__ } from './fake-__PORT_FOLDER__.ts';

const SAMPLE = __SAMPLE_VALUE__;

describe('createFake__PORT_NAME__', () => {
  it('answers the configured value', async () => {
    const port = createFake__PORT_NAME__({ value: SAMPLE });

    await expect(port.__QUERY__()).resolves.toStrictEqual({ ok: true, value: SAMPLE });
  });

  it('answers the configured failure as a value', async () => {
    const port = createFake__PORT_NAME__({
      value: SAMPLE,
      failure: { kind: 'unavailable', reason: 'offline' },
    });

    await expect(port.__QUERY__()).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'unavailable', reason: 'offline' },
    });
  });

  it('counts the queries', async () => {
    const port = createFake__PORT_NAME__({ value: SAMPLE });
    await port.__QUERY__();
    await port.__QUERY__();

    expect(port.callCount()).toBe(2);
  });
});
