// packages/shell/plugins/with-app-variant-marker.ts
import { withInfoPlist } from 'expo/config-plugins.js';

const withAppVariantMarker = (config: object): object => withInfoPlist(config, (next) => next);

/** @public Loaded by path. */
export default withAppVariantMarker;
