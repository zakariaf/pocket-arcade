// Stand-in for 'expo-constants' when check-ad-behaviour.mjs runs read-ads-extra.ts under Node.
// The checker sets constantsStub.extra to what withShell would have embedded. Not an entry point.

export const constantsStub = { extra: undefined };

const Constants = {
  get expoConfig() {
    return { extra: constantsStub.extra };
  },
};

export default Constants;
