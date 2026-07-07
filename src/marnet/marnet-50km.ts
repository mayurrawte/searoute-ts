import type { MarnetNetwork } from '../lib/finder.js';

import marnetData from '../../data/marnet-50km.cjs';

/**
 * Eurostat `marnet_plus_50km` maritime network (~15,498 LineString segments,
 * ~1.9 MB JSON) — roughly 1.6× the resolution of the bundled 100 km default.
 *
 * A modest step up in coastal-routing accuracy for a small size increase. Pass
 * it to the `network` option:
 *
 * ```ts
 * import { DEFAULT_MARNET } from 'searoute-ts/marnet-50km';
 * import { seaRoute } from 'searoute-ts';
 *
 * seaRoute(origin, destination, { network: DEFAULT_MARNET });
 * ```
 *
 * The network ships as a single shared `dist/data/marnet-50km.cjs` asset that
 * both the CJS and ESM builds resolve at runtime (see issue #10). Because it is
 * a subpath export, the core stays lean — you only pay for this network if you
 * import it.
 *
 * Source: https://github.com/eurostat/searoute (EUPL-1.2).
 */
export const DEFAULT_MARNET: MarnetNetwork = marnetData as MarnetNetwork;

export type { MarnetNetwork } from '../lib/finder.js';
export type { MarnetProperties } from '../lib/marnet.js';

export default DEFAULT_MARNET;
