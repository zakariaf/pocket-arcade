// packages/shell/src/services/ads/ad-config.ts
// A comment may say that eslint-disable comments are inert here, or mention --no-verify, freely.
import { adConfig as vendorConfig } from './vendor-types.ts';

// @ts-expect-error the vendor types miss the iOS-only rating field
export const AD_CONFIG = vendorConfig({ rating: 'PG' });
