# searoute-ts

> **Shortest sea route between any two points on Earth.** A TypeScript / JavaScript
> library for maritime route planning, port-to-port distance, ETA estimation, and
> shipping-lane visualisation — powered by the 2025 Eurostat maritime network.

[![npm version](https://img.shields.io/npm/v/searoute-ts.svg?style=flat)](https://www.npmjs.com/package/searoute-ts)
[![npm downloads](https://img.shields.io/npm/dw/searoute-ts.svg?style=flat)](https://www.npmjs.com/package/searoute-ts)
[![license](https://img.shields.io/npm/l/searoute-ts.svg?style=flat)](./LICENSE)
[![types](https://img.shields.io/npm/types/searoute-ts.svg?style=flat)](./dist/types/index.d.ts)

```bash
npm install searoute-ts
```

```ts
import { seaRoute } from 'searoute-ts';

const route = seaRoute([121.5, 31.0], [4.4, 51.9]);
// Shanghai → Rotterdam → GeoJSON LineString, ~10,664 nm via Suez Canal
```

---

## Why searoute-ts

- 🚢 **Realistic shipping routes**, not great-circle lines through Eurasia.
- 🗺️ **Returns GeoJSON** — drop straight into Leaflet, Mapbox, deck.gl, MapLibre.
- 🌊 **2025 Eurostat marnet** with explicit Suez, Panama, Bab-el-Mandeb,
  Malacca, Gibraltar, Dover, Kiel, Corinth, Bering, Magellan, NW/NE Passage labels.
- 🚫 **Canal & strait restrictions** — force Cape of Good Hope during a Red Sea
  disruption with one option.
- 📦 **Vessel-draft gating** — auto-block Panama (15.2 m), Suez (20.1 m), Kiel
  (7 m), Corinth (7.3 m) when the vessel exceeds the canal limit.
- 🛤️ **K-shortest alternatives** — `seaRouteAlternatives` returns the baseline
  plus up to N realistic alternatives.
- 🧭 **Multi-leg waypoints** — `seaRouteMulti` for port rotations and itineraries.
- ⏱️ **ETA from speed** — `speedKnots` → `durationHours`.
- 🛠️ **Modern toolchain** — TypeScript 5, ESM + CJS dual build, types included,
  Node 18+, zero peer deps.

## Quick examples

### Basic — shortest route

```ts
import { seaRoute } from 'searoute-ts';

const route = seaRoute([-74.04, 40.69], [-0.13, 51.5]); // NYC → London
// route.properties.length  // ≈ 3 362 nm
// route.properties.units   // 'nauticalmiles'
```

### With ETA and units

```ts
seaRoute(shanghai, rotterdam, {
  units: 'kilometers',
  speedKnots: 22,
});
// → 19 753 km, properties.durationHours ≈ 485 h (≈ 20 days)
```

### Red Sea / Suez disruption — force Cape of Good Hope

```ts
seaRoute(shanghai, rotterdam, {
  restrictions: ['suez', 'babelmandeb'],
});
// → routes via Cape of Good Hope, ~25 800 km
```

### Vessel-aware — Ultra Large Container Ship

```ts
seaRoute(shanghai, newYork, {
  vesselDraftMeters: 16,  // exceeds Panama's 15.2 m TFW
});
// → Panama auto-blocked, route goes via Suez
```

### Multi-leg / port rotation

```ts
import { seaRouteMulti } from 'searoute-ts';

seaRouteMulti(
  [shanghai, singapore, mumbai, rotterdam],
  { units: 'kilometers', returnPassages: true },
);
// → one concatenated LineString, total length, union of passages
```

### Alternative routes (Yen-style canal permutation)

```ts
import { seaRouteAlternatives } from 'searoute-ts';

const alts = seaRouteAlternatives(shanghai, rotterdam, { k: 4 });
//  baseline           19 753 km via Suez
//  no-malacca         20 759 km
//  no-suez            25 315 km (via Panama)
//  no-suez-no-panama  25 845 km (via Cape of Good Hope)
```

## Output shape

```ts
{
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[lon, lat], ...] },
  properties: {
    length: number,                    // in `units`, in-water only
    units: 'nauticalmiles' | 'kilometers' | 'miles' | ...,
    bbox: [minLon, minLat, maxLon, maxLat],
    greatCircleLength: number,         // haversine between inputs, same units
    detourRatio: number,               // routeKm / greatCircleKm
    originSnapKm: number,              // input → network distance
    destinationSnapKm: number,
    durationHours?: number,            // if `speedKnots` set
    passages?: ('suez' | 'panama' | ...)[],  // if `returnPassages: true`
  }
}
```

## Full options

```ts
seaRoute(origin, destination, {
  units:                   'nauticalmiles',          // any Turf unit
  restrictions:            ['suez', 'babelmandeb'],  // see passage table below
  allowArctic:             false,                    // default — blocks NWP & NEP
  vesselDraftMeters:       15,                       // auto-restrict canals
  speedKnots:              22,                       // → properties.durationHours
  appendOriginDestination: false,                    // prepend/append raw inputs
  returnPassages:          true,                     // populate properties.passages
  maxSnapDistanceKm:       50,                       // SnapFailedError if exceeded
  network:                 customMarnet,             // BYO FeatureCollection
});
```

Inputs can be `[lon, lat]` arrays, GeoJSON `Feature<Point>`, or bare `Point` objects.

## Restrictable passages

The first twelve are **natively labelled** in the Eurostat marnet (exact match
on the feature's `pass` attribute). The remaining four are detected via
bounding boxes.

| Name           | Type     | Notes                              |
|----------------|----------|------------------------------------|
| `suez`         | native   | Suez Canal                         |
| `panama`       | native   | Panama Canal                       |
| `gibraltar`    | native   | Strait of Gibraltar                |
| `babelmandeb`  | native   | Bab-el-Mandeb (`babalmandab` alias) |
| `malacca`      | native   | Malacca Strait                     |
| `dover`        | native   | Dover Strait                       |
| `kiel`         | native   | Kiel Canal                         |
| `corinth`      | native   | Corinth Canal                      |
| `bering`       | native   | Bering Strait                      |
| `magellan`     | native   | Strait of Magellan                 |
| `northwest`    | native   | Northwest Passage (blocked by default) |
| `northeast`    | native   | Northeast Passage (blocked by default) |
| `bosporus`     | bbox     | Bosphorus                          |
| `ormuz`        | bbox     | Strait of Hormuz                   |
| `sunda`        | bbox     | Sunda Strait                       |
| `cape_horn`    | bbox     | Cape Horn region                   |

The Northwest and Northeast Passages are mathematically the shortest path for
many Asia ↔ Europe routes but are ice-blocked most of the year, so they are
**blocked by default**. Opt in with `allowArctic: true`.

## Validated against industry distances

12 real-world lanes within ±10% of published Searoutes / Sea-Distances figures.

| Lane                              | searoute-ts | Industry ref. |
|-----------------------------------|-------------|---------------|
| Shanghai → Rotterdam (Suez)       | 19 753 km   | ~19 300 km    |
| Singapore → Rotterdam (Suez)      | 15 630 km   | ~15 500 km    |
| Mumbai → Rotterdam (Suez)         | 11 918 km   | ~11 800 km    |
| NY → Rotterdam                    |  6 227 km   | ~6 200 km     |
| NY → LA (Panama)                  |  9 154 km   | ~9 100 km     |
| Yokohama → LA                     |  9 145 km   | ~8 800 km     |
| Singapore → LA (trans-Pacific)    | 14 364 km   | ~14 300 km    |
| Caldera (CL) → Bahía Blanca (AR)  |  4 810 km   | ~5 180 km     |

All checks pass in the [test suite](./src/index.spec.ts).

## Errors

- **`SnapFailedError`** — input cannot be projected onto the network within
  `maxSnapDistanceKm`. Carries `.side: 'origin' | 'destination'` and
  `.distanceKm: number`.
- **`NoRouteError`** — no path exists between the snapped origin and destination
  (e.g. all viable canals blocked).

## API reference

```ts
import {
  seaRoute,                  // single shortest route
  seaRouteMulti,             // ordered waypoints (multi-leg)
  seaRouteAlternatives,      // K-shortest alternatives
  CANAL_MAX_DRAFT_M,         // { panama: 15.2, suez: 20.1, kiel: 7, corinth: 7.3 }
  DEFAULT_MARNET,            // bundled FeatureCollection<LineString>
  PASSAGE_BBOXES,            // passage bbox lookup
  clearFinderCache,          // drop the PathFinder cache (tests / hot reload)
  SnapFailedError,
  NoRouteError,
  // types
  type Passage,
  type SeaRouteOptions,
  type SeaRouteFeature,
  type SeaRouteProperties,
  type MarnetNetwork,
  type MarnetProperties,
} from 'searoute-ts';
```

## How it works

A two-page deep-dive (graph data, snapping, Dijkstra, restrictions,
antimeridian fix, draft logic, alternatives) is in [DOCS.md](./DOCS.md).

## FAQ

**Is this for navigation?** No. The routes are network paths suitable for
visualisation and rough distance/duration estimates, not for piloting ships.

**Does it support weather routing?** No. For weather-aware routing see
[VISIR-2](https://gmd.copernicus.org/articles/17/4355/2024/).

**Why are my Asia→Europe routes going through Bering Strait?** They aren't,
by default — the Northwest and Northeast Passages are blocked. Pass
`allowArctic: true` to enable them.

**Can I use my own network?** Yes — `seaRoute(origin, destination, { network })`.
Useful for higher-resolution Eurostat data (5/10/20/50 km), inland waterways,
or AIS-derived custom graphs.

**Does it handle the Red Sea / Suez crisis?** Yes — pass
`restrictions: ['suez', 'babelmandeb']` to force Cape of Good Hope routing.

**Is the great-circle distance correct across the antimeridian?** Yes — the
marnet has been normalised so the Pacific is a connected graph, and all
distances use haversine internally.

**What's the bundle size?** 329 KB packed / 2.5 MB unpacked on npm. The
bundled marnet is the bulk (~1.1 MB JSON per build). Tree-shakeable.

## Credits

- Maritime network — [Eurostat searoute v3.5](https://github.com/eurostat/searoute)
  (EUPL-1.2). Oak Ridge National Labs Global Shipping Lane Network enriched
  with European AIS data.
- Dijkstra — [`geojson-path-finder@2`](https://github.com/perliedman/geojson-path-finder) by Per Liedman.
- Inspired by [`searoute-py`](https://github.com/genthalili/searoute-py) (Apache-2.0).
- Original JS port — [@johnx25bd](https://github.com/johnx25bd/searoute).
- Geospatial primitives — [Turf.js](https://turfjs.org/).

## License

MIT © Mayur Rawte
