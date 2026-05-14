# How searoute-ts works

This document explains what happens between `seaRoute(origin, destination)` and the returned `Feature<LineString>`. It's aimed at people who want to understand, tune, or extend the library — for the typical "give me a sea route" use case, the README is enough.

## TL;DR

1. **Snap** origin and destination onto the nearest vertex of a worldwide maritime network graph.
2. **Run Dijkstra** over the graph to find the shortest path between those two vertices.
3. **Decorate** the resulting LineString with length, bbox, duration, traversed passages, etc.

That's it. Everything else (restrictions, vessel draft, alternatives) is layered on top of those three steps.

---

## 1. The maritime network (marnet)

The embedded network is `marnet_plus_100km.gpkg` from [Eurostat searoute v3.5](https://github.com/eurostat/searoute) (released Sep 2025), converted to GeoJSON.

- **Source:** Oak Ridge National Labs CTA Global Shipping Lane Network, enriched with AIS-derived European coastal lanes.
- **Resolution:** ~100 km between vertices.
- **Features:** 9 847 `LineString` segments, ~32 000 vertices.
- **Coordinate reference system:** EPSG:4326 (WGS 84 lon/lat).
- **Native passage labels:** 12 passages carry an explicit `pass` attribute on the feature itself — Suez, Panama, Gibraltar, Bab-el-Mandeb, Malacca, Dover, Kiel, Corinth, Bering, Magellan, Northwest Passage, Northeast Passage. The remaining 4 (Sunda, Bosphorus, Hormuz, Cape Horn) are detected geometrically.

### Antimeridian normalization

A common bug in maritime networks stored in `[-180, 180]` lon/lat space is that the eastern and western sides of the Pacific are disconnected — vertices at `(180, lat)` and `(-180, lat)` represent the same point on Earth but are different graph vertices. Without fixing this, a Yokohama → LA route can't cross the Pacific and instead routes 30 000 km east through Suez and Panama.

At data-conversion time, every vertex with `lon === 180` is rewritten to `lon === -180`. Now both sides converge to a single graph vertex. The edge-weight function uses haversine distance, which is correct across the antimeridian, so route lengths stay accurate.

### Other resolutions

Eurostat ships 5 km / 10 km / 20 km / 50 km / 100 km networks. We bundle only 100 km to keep the package small. For higher resolution, use the `network` option — see [Custom networks](#custom-networks).

---

## 2. Snapping

Given an input point at `[lon, lat]`, we project it onto the network in two passes:

1. **Nearest segment:** for every `LineString` feature in the network, compute the point-to-segment distance (`@turf/point-to-line-distance`) and keep the closest one. This is O(F) where F is the number of features (~10 000), which is fast enough in practice and matches what the original Eurostat Java library does.
2. **Nearest vertex on that segment:** walk the coordinates of the chosen feature and pick the geographically nearest vertex. Routing operates on graph vertices, not arbitrary points on a segment.

Two side-effects:

- `properties.originSnapKm` and `properties.destinationSnapKm` report how far the inputs moved when snapped. Useful for debugging routes that look "off" — if `originSnapKm` is 600 km, your input was nowhere near the sea.
- The `maxSnapDistanceKm` option throws `SnapFailedError` if the input is further than the threshold. Without it, a typo'd coordinate in the middle of a continent silently snaps to the nearest coast.

---

## 3. Shortest path

The pathfinder is [`geojson-path-finder@2`](https://github.com/perliedman/geojson-path-finder), an actively-maintained TypeScript-rewritten library that implements **Dijkstra's algorithm** with a min-heap (`tinyqueue`).

### Graph construction

When a `PathFinder` is instantiated, it:

1. Iterates every coordinate in every `LineString` and builds a **topology** — a map from coordinate keys to vertices and their neighbours.
2. **Compacts** the graph by collapsing chains of degree-2 vertices into single edges. This makes Dijkstra much faster because canals/coastlines that have hundreds of intermediate points become a single edge with cumulative weight.
3. Optionally calls a **weight function** for every edge (see [Restrictions](#4-restrictions)).

Graph construction takes ~500 ms–1 s for the 100 km network. We cache the constructed `PathFinder` keyed by `(network identity, sorted restriction set)`, so repeated calls with the same restrictions are essentially free.

### Why Dijkstra and not A\*?

A\* needs an admissible heuristic (a function that never overestimates remaining distance). Great-circle distance is admissible in flat earth-projected space, but the marnet's topology means the *actual* shortest path through the graph can be much longer than the great circle (think Asia → Europe via Suez). A\* would still work but offers no speed-up over Dijkstra on this graph in practice, and Dijkstra is what the upstream library implements.

---

## 4. Restrictions

A user-provided `restrictions: Passage[]` (plus any auto-added ones from `vesselDraftMeters` and the arctic default) modifies the edge-weight function passed to `PathFinder`:

```ts
weight: (a, b, props) => {
  if (props?.pass && nativeLabels.has(props.pass)) return 0;          // native check
  if (bboxBlocks.length && edgeIntersectsAny(a, b, bboxBlocks)) return 0; // fallback
  return haversineDistanceKm(a, b);
}
```

Weight `0` tells `PathFinder` the edge is non-passable, so Dijkstra never traverses it.

- **Native check:** uses the `pass` attribute on the marnet feature itself. Exact, no false positives. Available for the 12 canals/straits that Eurostat labels.
- **Bbox fallback:** for passages without native labels, we sample 6 points along the edge and check if any falls inside the passage's bounding box. This catches both midpoint-in-bbox cases and long edges that "jump" a narrow channel.

### Arctic gating

The Northwest and Northeast Passages are mathematically the shortest path for many Asia ↔ Europe and Asia ↔ East-Coast-Americas routes (think Yokohama → New York via the Bering Strait + Northwest Passage). They are ice-blocked most of the year and not used by commercial shipping. So they're **blocked by default**. Opt in with `allowArctic: true`.

### Vessel draft

`vesselDraftMeters` auto-adds canals to `restrictions` when the draft exceeds the canal's limit. Hardcoded limits (`CANAL_MAX_DRAFT_M`):

| Canal   | Limit (m)   | Source                |
|---------|-------------|-----------------------|
| Panama  | 15.2        | Neopanamax / Agua Clara locks TFW |
| Suez    | 20.1        | Suez Canal Authority full-beam |
| Kiel    | 7.0         | Kiel Canal transit    |
| Corinth | 7.3         | Corinth Canal         |

Open straits (Malacca, Hormuz, Gibraltar, etc.) aren't draft-limited at the canal level so they aren't affected here.

---

## 5. Output decoration

Once the LineString is built, properties are computed:

- `length` — sum of haversine distances between consecutive route coordinates, converted to `units` via the Turf unit system.
- `units` — echoed from the input.
- `bbox` — `[minLon, minLat, maxLon, maxLat]` over the in-water route coordinates.
- `greatCircleLength` — haversine distance between the **input** origin and destination (not the snapped ones).
- `detourRatio` — `routeLengthKm / greatCircleKm`. Around 1.05 for trans-Atlantic, 2+ for Asia-Europe via Suez (because the great circle through Eurasia isn't navigable). Useful for sanity checks.
- `originSnapKm`, `destinationSnapKm` — how far the inputs were from the snapped vertex.
- `durationHours` — `routeLengthKm / (speedKnots × 1.852)` when `speedKnots > 0`.
- `passages` — when `returnPassages: true`, lists the named passages whose bboxes contain at least one route coordinate.

The `length` is always measured on the **in-water** portion only. If you set `appendOriginDestination: true`, the LineString has the raw origin and destination prepended/appended, but `length` stays in-water — so it's stable across that toggle.

---

## 6. Multi-leg routes (`seaRouteMulti`)

`seaRouteMulti([p1, p2, p3, ...], options)` simply calls `seaRoute` on each consecutive pair and concatenates the LineStrings, dropping the duplicate join vertex between legs. Length is the sum across legs. `passages` is the union. `durationHours` is computed from the total km.

It's the right tool for port-rotation problems ("what's a route hitting Shanghai → Singapore → Mumbai → Rotterdam in order?"). It does **not** solve the travelling salesman problem — waypoints are visited in the given order.

---

## 7. Alternatives (`seaRouteAlternatives`)

True K-shortest-paths via Yen's algorithm needs per-edge graph manipulation that `geojson-path-finder` doesn't expose cheaply. Instead, we use a **canal-permutation** variant that's much more useful in practice for maritime routing.

### The algorithm

1. For each of N preset variants (`baseline`, `no-suez`, `no-panama`, `no-suez-no-panama`, `no-malacca`, `no-gibraltar`), compute a route by adding that variant's restrictions to the user's base restrictions.
2. Sort results by length (ascending).
3. Walk the sorted list and accept each candidate that's not within `similarityThreshold` of an already-accepted route (default 2%).
4. Stop when `k` routes are accepted.

This gives results that map directly to real-world questions: "what's the route via Suez? What if Suez is closed? What if Panama is also out?" That's what people actually want when they ask for alternatives.

### Why not Yen's

Yen's iteratively constructs the graph minus one edge of the previous best path. For the marnet at 100 km resolution, a Shanghai → Rotterdam route has ~60 segments. Yen's for K=3 alternatives would build ~120 new PathFinder instances at ~1 s each — too slow. And the alternatives it produces typically differ from the baseline by one or two graph nodes, which is meaningless visually and operationally.

The canal-permutation approach has a fixed cost regardless of route length and produces alternatives that look genuinely different on a map.

---

## 8. Custom networks

Pass your own `FeatureCollection<LineString>` via `options.network` to override the bundled marnet.

```ts
import marnet50km from './eurostat-50km.json';
seaRoute(origin, destination, { network: marnet50km });
```

Useful for:

- **Higher resolution:** Eurostat ships 5/10/20/50 km networks. The 20 km network is ~3.4 MB GeoJSON, 30 000 features.
- **Custom domains:** inland waterways, regional networks, or a graph derived from your own AIS data.
- **Pre-tuned graphs:** if you maintain a curated marnet for your business.

The finder cache is keyed by network identity, so swapping networks at runtime works correctly. If your custom network has feature properties matching the supported `pass` labels, native passage restrictions will work automatically.

---

## 9. What this is *not*

- **Navigation.** Routes are graph paths, not great-circle or rhumb-line tracks. Don't sail them.
- **Weather-aware.** No wave height, currents, ice forecasts, or seasonal variation. The Northwest/Northeast Passages are gated by `allowArctic`, not by an ice model. For weather routing see [VISIR-2](https://gmd.copernicus.org/articles/17/4355/2024/).
- **Port-aware.** No port database, ETAs, or berth selection. Routes terminate at the nearest network vertex to the input coordinates.
- **Emissions-grade.** Duration estimates assume constant speed in calm water. For CO₂ accounting see [searoutes.com](https://searoutes.com/co2-api/) or implement your own model on top of the duration.

---

## 10. Performance notes

- First call: ~1–2 s (PathFinder construction).
- Subsequent calls with the same restriction set: ~50–200 ms (cache hit on the finder; cost is snap + Dijkstra).
- Subsequent calls with different restrictions: ~500 ms–1 s (new PathFinder, cached after first build).
- `seaRouteAlternatives` with default `k=3`: ~2 s for the first call (builds 6 finders), <500 ms after.
- `seaRouteMulti(N points)`: roughly `(N-1) ×` the single-leg cost.

Bundle size on npm: ~430 KB compressed / ~6.3 MB unpacked (CJS + ESM + types + bundled marnet). The marnet itself accounts for ~1.1 MB per build.

---

## References

- [Eurostat searoute](https://github.com/eurostat/searoute) — upstream Java implementation and marnet source.
- [genthalili/searoute-py](https://github.com/genthalili/searoute-py) — Python implementation; influenced the option naming and ports model.
- [geojson-path-finder](https://github.com/perliedman/geojson-path-finder) — the underlying Dijkstra library.
- [Turf.js](https://turfjs.org/) — geospatial primitives.
- Yen, J. Y. (1971). "[Finding the K Shortest Loopless Paths in a Network](https://pubsonline.informs.org/doi/10.1287/mnsc.17.11.712)". *Management Science* 17(11).
- [VISIR-2 (GMD 2024)](https://gmd.copernicus.org/articles/17/4355/2024/) — Open-source ship weather routing with wave angle and CMEMS currents.
