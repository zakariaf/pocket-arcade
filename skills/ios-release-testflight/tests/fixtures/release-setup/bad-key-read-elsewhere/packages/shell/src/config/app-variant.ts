// packages/shell/src/config/app-variant.ts
// Pure: resolves the build variant from an environment snapshot. Runs in Node (app.config.ts).

export const APP_VARIANTS = ['test', 'store'] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

export const ADS_MODES = ['off', 'test', 'live'] as const;
export type AdsMode = (typeof ADS_MODES)[number];

export type BuildVariant = { readonly appVariant: AppVariant; readonly adsMode: AdsMode };
export type BuildEnv = Readonly<Record<string, string | undefined>>;

const ADS_MODES_BY_VARIANT: Readonly<Record<AppVariant, readonly AdsMode[]>> = {
  test: ['off', 'test'],
  store: ['off', 'live'],
};

type ParseOptions<T extends string> = {
  readonly name: string;
  readonly raw: string | undefined;
  readonly allowed: readonly T[];
  readonly fallback: T;
};

function parseOneOf<T extends string>(options: ParseOptions<T>): T {
  const { name, raw, allowed, fallback } = options;
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const match = allowed.find((value) => value === raw);
  if (match === undefined) {
    throw new Error(`${name}=${raw} is not one of ${allowed.join('|')}`);
  }
  return match;
}

export function resolveBuildVariant(env: BuildEnv): BuildVariant {
  const appVariant = parseOneOf({
    name: 'APP_VARIANT',
    raw: env['APP_VARIANT'],
    allowed: APP_VARIANTS,
    fallback: 'test',
  });
  const inlined = env['EXPO_PUBLIC_APP_VARIANT'] ?? 'test';
  if (inlined !== appVariant) {
    throw new Error(`EXPO_PUBLIC_APP_VARIANT=${inlined} must equal APP_VARIANT=${appVariant}`);
  }
  const adsMode = parseOneOf({
    name: 'ADS_MODE',
    raw: env['ADS_MODE'],
    allowed: ADS_MODES,
    fallback: appVariant === 'store' ? 'live' : 'test',
  });
  if (!ADS_MODES_BY_VARIANT[appVariant].includes(adsMode)) {
    throw new Error(`ADS_MODE=${adsMode} is not allowed when APP_VARIANT=${appVariant}`);
  }
  return { appVariant, adsMode };
}
