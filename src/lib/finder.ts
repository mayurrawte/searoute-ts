import distance from '@turf/distance';
import type { FeatureCollection, LineString } from 'geojson';
import PathFinder from 'geojson-path-finder';

import marnetDefault from './marnet.js';
import type { MarnetProperties } from './marnet.js';
import { edgeIntersectsAny, partitionRestrictions, type Passage } from './restrictions.js';

// geojson-path-finder ships dual CJS/ESM but without an `exports` map. Node
// ESM consumers therefore see the CJS namespace; unwrap the real class.
const PathFinderCtor: typeof PathFinder = ((
  PathFinder as unknown as {
    default?: typeof PathFinder;
  }
).default ?? PathFinder) as typeof PathFinder;

export type MarnetNetwork = FeatureCollection<LineString, MarnetProperties>;
export type Finder = PathFinder<unknown, MarnetProperties>;

/** The bundled Eurostat marnet_plus_100km network (default). */
export const DEFAULT_MARNET: MarnetNetwork = marnetDefault;

// Assign each network a stable string id (object identity) so we can key the
// finder cache by (networkId, restrictionsKey) without holding strong refs.
const networkIds = new WeakMap<MarnetNetwork, string>();
let nextNetworkId = 0;
function networkIdOf(net: MarnetNetwork): string {
  let id = networkIds.get(net);
  if (!id) {
    id = `n${++nextNetworkId}`;
    networkIds.set(net, id);
  }
  return id;
}

const finderCache = new Map<string, Finder>();

export function buildFinder(network: MarnetNetwork, restrictions: readonly Passage[]): Finder {
  const restrictionsKey = [...new Set(restrictions)].sort().join(',');
  const cacheKey = `${networkIdOf(network)}|${restrictionsKey}`;
  const cached = finderCache.get(cacheKey);
  if (cached) return cached;

  const { nativeLabels, bboxBlocks } = partitionRestrictions(restrictions);

  const finder = restrictionsKey
    ? (new PathFinderCtor(network, {
        weight: (a, b, props) => {
          if (props?.pass && nativeLabels.has(props.pass)) return 0;
          if (bboxBlocks.length && edgeIntersectsAny(a, b, bboxBlocks)) return 0;
          return distance(a, b, { units: 'kilometers' });
        },
      }) as Finder)
    : (new PathFinderCtor(network) as Finder);

  finderCache.set(cacheKey, finder);
  return finder;
}

/** Drop all cached PathFinder instances. Useful for hot reloads / tests. */
export function clearFinderCache(): void {
  finderCache.clear();
}
