import type { MarnetNetwork } from '../lib/finder.js';

import marnetData from '../../data/marnet-20km.cjs';

/**
 * Eurostat `marnet_plus_20km` maritime network (~29,581 LineString segments,
 * ~3.6 MB JSON) — roughly 3× the resolution of the bundled 100 km default.
 *
 * Finer resolution gives more accurate coastal routing and shorter-hop
 * fidelity, at the cost of a larger download and slightly slower first-route
 * graph construction. Pass it to the `network` option:
 *
 * ```ts
 * import { DEFAULT_MARNET } from 'searoute-ts/marnet-20km';
 * import { seaRoute } from 'searoute-ts';
 *
 * seaRoute(origin, destination, { network: DEFAULT_MARNET });
 * ```
 *
 * The network ships as a single shared `dist/data/marnet-20km.cjs` asset that
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
