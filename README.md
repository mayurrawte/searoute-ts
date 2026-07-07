# searoute-ts

> **Shortest sea route between any two points on Earth.** A TypeScript / JavaScript
> library for maritime route planning, port-to-port distance, ETA estimation, and
> shipping-lane visualisation — powered by the 2025 Eurostat maritime network.

[![npm version](https://img.shields.io/npm/v/searoute-ts.svg?style=flat)](https://www.npmjs.com/package/searoute-ts)
[![npm downloads](https://img.shields.io/npm/dw/searoute-ts.svg?style=flat)](https://www.npmjs.com/package/searoute-ts)
[![CI](https://github.com/mayurrawte/searoute-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/mayurrawte/searoute-ts/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/searoute-ts.svg?style=flat)](https://github.com/mayurrawte/searoute-ts/blob/main/LICENSE)
[![types](https://img.shields.io/npm/types/searoute-ts.svg?style=flat)](https://www.npmjs.com/package/searoute-ts)

```bash
npm install searoute-ts
```

```ts
import { seaRoute } from 'searoute-ts';

const route = seaRoute([121.5, 31.0], [4.4, 51.9]);
// Shanghai → Rotterdam → GeoJSON LineString, ~10,664 nm via Suez Canal
```

**🗺️ [Try the interactive demo](https://mayurrawte.github.io/searoute-ts/)** — click two points on a map and see the route, with all options live. ([source](https://github.com/mayurrawte/searoute-ts/tree/main/examples/web-demo))

> Works from plain JavaScript too — the package ships compiled `.js` plus
> `.d.ts` declarations. The `-ts` in the name is for searchability, not a
> language requirement.

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

### Port codes (UN/LOCODE)

```ts
import 'searoute-ts/ports'; // enables UN/LOCODE strings on the core API
import { seaRoute } from 'searoute-ts';

seaRoute('CNSHA', 'NLRTM'); // Shanghai → Rotterdam
seaRoute('CNSHA', [4.4, 51.9]); // mixing a code and coordinates is fine too
```

The ~1 600-port dataset lives behind the `searoute-ts/ports` subpath so the core
stays lean — importing it registers the resolver. You can also resolve codes
yourself:

```ts
import { lookupPort, resolvePort } from 'searoute-ts/ports';

lookupPort('SGSIN'); // → { code, name: 'Singapore', country, coordinates: [lon, lat] }
resolvePort('SGSIN'); // → [103.85, 1.28]
```

Unknown codes throw `UnknownPortError`. See [Port codes](#port-codes-unlocode-1) below for provenance.

#### Load the port dataset from a CDN instead of bundling it

Don't want to bundle the ~135 KB dataset? Fetch it at runtime with `loadPorts` —
the analog of [`loadNetwork`](#fetch-the-network-from-a-url-instead-of-bundling-it-optional).
The dataset also ships as a raw `dist/ports.json`, so **jsDelivr/unpkg serve it
versioned for free**:

```ts
import { seaRoute, loadPorts } from 'searoute-ts';

// Pin a version for reproducibility, or use @latest to always get the newest.
await loadPorts('https://cdn.jsdelivr.net/npm/searoute-ts@latest/dist/ports.json');

seaRoute('CNSHA', 'NLRTM'); // works — the fetched dataset is now registered
```

```
https://cdn.jsdelivr.net/npm/searoute-ts@latest/dist/ports.json      # newest
https://cdn.jsdelivr.net/npm/searoute-ts@<version>/dist/ports.json   # frozen/immutable
```

(`dist/ports.json` ships from the release that adds port codes onward — pin any
version at or after it for reproducibility.)

`loadPorts` registers the fetched dataset (so code strings resolve) and returns
it. It uses the global `fetch` (Node ≥18 / browsers); pass `{ fetch }` to override.

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

### Fetch the network from a URL instead of bundling it (optional)

The network is bundled by default, so `seaRoute` works offline with zero setup.
If you'd rather **not** ship the ~1 MB network (e.g. to trim a browser bundle,
or to use an updated network without upgrading the package), fetch it at
runtime and pass it via the existing `network` option:

```ts
import { seaRoute, loadNetwork } from 'searoute-ts';

// CORS-enabled, served from GitHub Pages (or point at your own host / a CDN).
const network = await loadNetwork('https://mayurrawte.github.io/searoute-ts/marnet.json');

const route = seaRoute(shanghai, rotterdam, { network });
```

Only the fetch is async — `seaRoute` itself stays synchronous. `loadNetwork`
uses the global `fetch` (Node ≥18 and all browsers); pass `{ fetch }` to supply
your own. This is purely opt-in; nothing changes if you don't use it.

#### Which option should I use?

| Approach | How | Data version | Works offline | Best for |
|----------|-----|--------------|---------------|----------|
| **Bundled** (default) | `seaRoute(a, b)` — no `network` | pinned to your installed package | ✅ | Most users; zero config, deterministic |
| **Latest via URL** | `loadNetwork('…/marnet.json')` | always the newest hosted | ❌ needs network | Always-current data without upgrading |
| **Pinned via CDN** | `loadNetwork('https://cdn.jsdelivr.net/npm/searoute-ts@2.0.1/…')` | frozen (immutable) | ❌ needs network | Reproducible builds |

#### Versioning the hosted network

You choose the version by choosing the **URL**:

- **`@latest` / rolling** — the GitHub Pages URL above always serves the current
  network. Convenient, but it can change under you.
- **Pinned & immutable** — because the package is on npm, **jsDelivr** and
  **unpkg** serve every published version automatically, with immutable
  per-version URLs:

  ```
  https://cdn.jsdelivr.net/npm/searoute-ts@latest/dist/marnet.json   # newest
  https://cdn.jsdelivr.net/npm/searoute-ts@2/dist/marnet.json        # newest 2.x
  https://cdn.jsdelivr.net/npm/searoute-ts@2.0.1/dist/marnet.json    # frozen
  ```

  A pinned URL never changes, so your routes stay reproducible. (These
  standalone-JSON CDN paths land with the package once the network ships as a
  separate asset — see issue #10; until then, use the GitHub Pages URL.)

For production, prefer a **pinned** URL (or just the bundled default) so your
distances don't shift when the network is updated.

### Higher-resolution networks (optional)

The bundled network is Eurostat's **100 km** `marnet_plus`. Eurostat also
publishes finer resolutions, which give more accurate coastal routing and
shorter-hop fidelity at the cost of a larger download and slightly slower
first-route graph construction. Two moderate resolutions ship as **subpath
exports** so you only pay for them if you import them:

```ts
import { DEFAULT_MARNET } from 'searoute-ts/marnet-20km'; // or 'searoute-ts/marnet-50km'
import { seaRoute } from 'searoute-ts';

seaRoute(origin, destination, { network: DEFAULT_MARNET });
```

Like the bundled default, each variant ships once as a shared
`dist/data/marnet-<res>.cjs` asset that both the CJS and ESM builds load at
runtime, so importing a variant doesn't duplicate the network across builds.

| Import | Resolution | Segments | JSON size | gzipped | Coastal accuracy |
| --- | --- | --- | --- | --- | --- |
| `searoute-ts` (bundled default) | 100 km | 9,847 | ~1.3 MB | ~0.18 MB | Baseline — good for global routing |
| `searoute-ts/marnet-50km` | 50 km | 15,498 | ~1.9 MB | ~0.27 MB | Modest step up |
| `searoute-ts/marnet-20km` | 20 km | 29,581 | ~3.6 MB | ~0.51 MB | Noticeably finer coastal hops |
| via `loadNetwork` (see below) | 10 km | 48,301 | ~5.9 MB | ~0.84 MB | High — larger download |
| via `loadNetwork` (see below) | 5 km | 72,478 | ~9.0 MB | ~1.24 MB | Highest — largest download |

The 10 km and 5 km networks are large enough that bundling them would dominate
the install, so they are **not** shipped in the package. Generate them from the
Eurostat source with `scripts/build-marnet.cjs` (the script header documents the
GDAL conversion), host the resulting JSON, and load it with
[`loadNetwork`](#fetch-the-network-from-a-url-instead-of-bundling-it-optional)
— or pass any `FeatureCollection<LineString>` to the `network` option directly.

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
  antimeridian:            'split',                  // 'unwrap' | 'split' dateline handling
});
```

Inputs can be `[lon, lat]` arrays, GeoJSON `Feature<Point>`, bare `Point` objects,
or a UN/LOCODE string (e.g. `'CNSHA'`) once `searoute-ts/ports` is imported.

### Antimeridian (dateline) handling

Routes that cross the ±180° meridian (e.g. Yokohama → LA) come back wrapped to
`[-180, 180]` by default, which many map renderers draw as a straight streak
across the whole map. Pass `antimeridian` to get map-ready geometry:

```ts
seaRoute(yokohama, la, { antimeridian: 'unwrap' }); // continuous LineString (may exceed ±180)
seaRoute(yokohama, la, { antimeridian: 'split' });  // MultiLineString cut at ±180 (RFC 7946)
```

`'unwrap'` shifts longitudes by multiples of 360° so the line never jumps the
dateline (ideal for MapLibre/Leaflet/Deck.gl). `'split'` cuts the route into a
`MultiLineString` at ±180°, keeping every coordinate in range. Both apply to
`seaRoute` and `seaRouteMulti`; `properties.length` is unchanged either way.

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

All checks pass in the [test suite](https://github.com/mayurrawte/searoute-ts/blob/main/src/index.spec.ts).

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
  loadNetwork,               // optional: fetch a network from a URL/CDN
  CANAL_MAX_DRAFT_M,         // { panama: 15.2, suez: 20.1, kiel: 7, corinth: 7.3 }
  DEFAULT_MARNET,            // bundled FeatureCollection<LineString>
  PASSAGE_BBOXES,            // passage bbox lookup
  clearFinderCache,          // drop the PathFinder cache (tests / hot reload)
  SnapFailedError,
  NoRouteError,
  UnknownPortError,          // thrown for unresolved UN/LOCODE strings
  registerPortResolver,      // plug in a custom port dataset
  // types
  type Passage,
  type Antimeridian,
  type SeaRouteOptions,
  type SeaRouteFeature,
  type SeaRouteMultiFeature,
  type SeaRouteProperties,
  type LoadNetworkOptions,
  type MarnetNetwork,
  type MarnetProperties,
} from 'searoute-ts';

import {
  lookupPort,                // UN/LOCODE → { code, name, country, coordinates }
  resolvePort,               // UN/LOCODE → [lon, lat]
  PORTS,                     // the raw dataset (Record<code, PortRecord>)
  PORT_COUNT,
  type Port,
  type PortRecord,
} from 'searoute-ts/ports';
```

## Port codes (UN/LOCODE)

Origins and destinations may be given as UN/LOCODE strings (e.g. `'CNSHA'`)
instead of coordinates. The port dataset ships behind the `searoute-ts/ports`
subpath export, so consumers only pay for it if they use it — importing the
subpath (for any of its exports, or purely for its side effect) registers a
resolver into the core so `seaRoute('CNSHA', 'NLRTM')` works.

- **~1 600 seaports**, keyed by UN/LOCODE (primary codes and aliases).
- **Source:** [marchah/sea-ports](https://github.com/marchah/sea-ports) (MIT),
  itself derived from **UN/LOCODE**. Regenerate with `scripts/build-ports.cjs`.
- **Coordinates are approximate** (port-city granularity) — the routing engine
  snaps them onto the network anyway, so this is fine for distance/visualisation.
- Unknown or malformed codes throw `UnknownPortError`.

## How it works

A two-page deep-dive (graph data, snapping, Dijkstra, restrictions,
antimeridian fix, draft logic, alternatives) is in [DOCS.md](https://github.com/mayurrawte/searoute-ts/blob/main/DOCS.md).

## FAQ

**Is this for navigation?** No. The routes are network paths suitable for
visualisation and rough distance/duration estimates, not for piloting ships.

**Does it support weather routing?** No. For weather-aware routing see
[VISIR-2](https://gmd.copernicus.org/articles/17/4355/2024/).

**Why are my Asia→Europe routes going through Bering Strait?** They aren't,
by default — the Northwest and Northeast Passages are blocked. Pass
`allowArctic: true` to enable them.

**Can I use my own network?** Yes — `seaRoute(origin, destination, { network })`.
Useful for inland waterways or AIS-derived custom graphs. For higher-resolution
Eurostat data (5/10/20/50 km), see
[Higher-resolution networks](#higher-resolution-networks-optional) — 20 km and
50 km ship as subpath exports.

**Does it handle the Red Sea / Suez crisis?** Yes — pass
`restrictions: ['suez', 'babelmandeb']` to force Cape of Good Hope routing.

**Is the great-circle distance correct across the antimeridian?** Yes — the
marnet has been normalised so the Pacific is a connected graph, and all
distances use haversine internally.

**What's the bundle size?** What you import at runtime is small: the core plus
the bundled 100 km marnet (~1.1 MB JSON, shipped once as a shared
`dist/data/marnet.cjs` asset both builds load, rather than inlined into each).
Tree-shakeable, so the optional `searoute-ts/marnet-20km` / `marnet-50km`
networks only load if you import them. They do add to the npm tarball, though —
including them the package is ~1.1 MB packed / ~7 MB unpacked (each variant is a
single shared asset, not duplicated per build). If you need the finer networks
without the install cost, generate and host them and use `loadNetwork` instead.

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
