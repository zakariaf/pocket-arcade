import { createExpoIapPurchaseAdapter } from './expo-iap-purchase-adapter.ts';

type MockedIap = { readonly initConnection: jest.Mock<Promise<boolean>> };

const iap = jest.requireMock<MockedIap>('expo-iap');

describe('createExpoIapPurchaseAdapter', () => {
  it('connects once', async () => {
    await createExpoIapPurchaseAdapter().connect();
    expect(iap.initConnection).toHaveBeenCalledTimes(1);
  });
});
