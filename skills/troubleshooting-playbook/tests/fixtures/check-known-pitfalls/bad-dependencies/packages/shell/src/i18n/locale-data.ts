// packages/shell/src/i18n/locale-data.ts
import ckb from './catalogs/ckb.json' with { type: 'json' };
import de from './catalogs/de.json' with { type: 'json' };
import en from './catalogs/en.json' with { type: 'json' };
import fa from './catalogs/fa.json' with { type: 'json' };

export const CATALOGS = { en, de, fa, ckb } as const;
