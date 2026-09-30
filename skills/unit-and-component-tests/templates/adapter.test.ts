// packages/shell/src/services/__PORT_AREA__/__ADAPTER_FILE__.test.ts
// Drives a vendor adapter against the root manual mock __mocks__/__SDK_MODULE__.ts. Test code never
// imports the SDK itself. The explicit jest.mock() makes this file share the mock instance the
// adapter imported; jest.requireMock() then reads it, typed with only what the assertions need.
// Without the jest.mock() line, requireMock returns a SECOND instance and every assertion sees
// zero calls (verified with Jest 29.7).
import { __ADAPTER_FACTORY__ } from './__ADAPTER_FILE__.ts';

jest.mock('__SDK_MODULE__');

type MockedSdk = {
  readonly __SDK_EXPORT__: {
    readonly __SDK_METHOD__: jest.Mock<Promise<unknown>>;
  };
};

const { __SDK_EXPORT__ } = jest.requireMock<MockedSdk>('__SDK_MODULE__');

describe('__ADAPTER_FACTORY__', () => {
  it('__MAPPING_TITLE__', async () => {
    __SDK_EXPORT__.__SDK_METHOD__.mockResolvedValueOnce(__SDK_RESULT__);
    const adapter = __ADAPTER_FACTORY__({ onError: jest.fn() });

    await expect(adapter.__PORT_METHOD__()).resolves.toStrictEqual(__PORT_RESULT__);
  });

  it('__FAILURE_TITLE__', async () => {
    const onError = jest.fn();
    const failure = new Error('offline');
    __SDK_EXPORT__.__SDK_METHOD__.mockRejectedValueOnce(failure);

    await expect(__ADAPTER_FACTORY__({ onError }).__PORT_METHOD__()).resolves.toStrictEqual(
      __FALLBACK_RESULT__,
    );
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
