# Changelog

## 2.0.0 — 2026-05-14

Major modernisation. Breaking changes; see migration notes below.

### Added
- `restrictions` option to forbid named passages (Suez, Panama, Gibraltar,
  Bab-el-Mandeb, Bosphorus, Hormuz, Malacca, Sunda, Dover, Kiel, Corinth, Bering,
  Magellan, Cape Horn, Northwest Passage, Northeast Passage). Implemented as a
  weight function over the Dijkstra graph; zero-weight edges are non-passable.
- `allowArctic` option (default `false`) — gates the Northwest and Northeast
  Passages, which are mathematically the shortest path for many Asia-Europe
  pairs but ice-blocked most of the year.
- `vesselDraftMeters` option — auto-blocks canals whose draft limit the vessel
  exceeds. Limits exposed via `CANAL_MAX_DRAFT_M` (Panama 15.2 m, Suez 20.1 m,
  Kiel 7.0 m, Corinth 7.3 m).
- `maxSnapDistanceKm` option — throw `SnapFailedError` when an input is
  further than the threshold from any sea route.
- `network` option — bring your own marnet `FeatureCollection<LineString>`.
- `speedKnots` option → `properties.durationHours`.
- `appendOriginDestination` option to prepend/append the raw input points.
- `returnPassages` option → `properties.passages` lists straits the route crossed.
- `seaRouteMulti(points[], options)` — concatenated route through ordered waypoints.
- `seaRouteAlternatives(o, d, { k })` — up to K distinct alternative routes by
  canal permutation (baseline / no-suez / no-panama / no-suez-no-panama /
  no-malacca / no-gibraltar). Sorted ascending by length; deduplicated by
  configurable similarity threshold.
- `properties.bbox` (always populated).
- `properties.greatCircleLength` and `properties.detourRatio` (always populated).
- `properties.originSnapKm` and `properties.destinationSnapKm` (always populated)
  — matches Eurostat searoute's `dFromKM` / `dToKM`.
- Typed `SnapFailedError` (with `.side` and `.distanceKm`) and `NoRouteError`
  instead of returning `null` silently.
- `clearFinderCache()` escape hatch (mostly for tests and hot reloads).
- Position-array input is now accepted in addition to GeoJSON points.
- Dual ESM/CJS build with proper `exports` map and `types`.
- Comprehensive [`DOCS.md`](./DOCS.md) explainer covering algorithms, data,
  antimeridian handling, restrictions, alternatives, custom networks, and
  performance characteristics.

### Fixed
- Nautical-mile length calculation was off by ~32% — previously computed
  `miles × 1.15078` instead of using Turf's `nauticalmiles` unit directly.
- `snapToNetwork` no longer falls back to feature index 0 when no line is
  within 30 000 km — the initial distance is `Infinity`, and a `SnapFailedError`
  is thrown if snapping truly fails.
- Stray `console.log(nearestLineIndex)` removed.
- The 0-byte `src/constants/marnetDensified.json` placeholder is gone.

### Changed (breaking)
- Replaced abandoned `ts-geojson-path-finder@1.0.3` with upstream
  `geojson-path-finder@^2` (TypeScript rewrite, actively maintained as of
  2025-11-15).
- Upgraded all `@turf/*` deps from 6.x → 7.x; dropped the monolithic
  `@turf/turf` (only five sub-packages are actually used).
- Function returns `SeaRouteFeature` (typed) instead of a loosely-typed Feature.
- Node engines bumped from `>=10` to `>=18`.
- TypeScript 4.0 → 5.7; ESLint 7 → 9 (flat config); Prettier 2 → 3.
- Removed deprecated tooling: `cspell`, `codecov`, `nyc`, `eslint-plugin-functional`,
  `standard-version`, the `prepare-release` workflow.

### Migration

```diff
- import seaRoute from 'searoute-ts';
- const route = seaRoute(origin, destination, 'miles');
+ import { seaRoute } from 'searoute-ts';
+ const route = seaRoute(origin, destination, 'miles');
```

If you previously checked `route === null`, switch to a `try/catch` on
`NoRouteError`. If you relied on the inflated v1 nautical-mile lengths, you'll
see ~24% smaller numbers — they now match the geodesic length in nm correctly.

### Data
- Embedded network refreshed from the 2022 `marnet_densified_` snapshot to
  Eurostat searoute v3.5 `marnet_plus_100km.gpkg` (Sep 2025). 9 847 segments
  (was 3 599) with explicit `pass` labels for Suez, Panama, Malacca,
  Gibraltar, Bab-el-Mandeb, Kiel, Corinth, Dover, Bering, Magellan,
  Northwest Passage, Northeast Passage.
- Restrictions now use the native `pass` attribute when available and fall
  back to bounding-box detection for the four unlabelled passages
  (`sunda`, `bosporus`, `ormuz`, `cape_horn`).
- Fixed antimeridian gap: vertices at `lon === 180` are normalised to
  `lon === -180` so the graph isn't disconnected across the Pacific. Without
  this, trans-Pacific routes (Yokohama → LA, Sydney → Vancouver) were
  taking absurd ~30 000 km detours via Suez and Panama.
- Added `allowArctic` option (default `false`) that gates the Northwest and
  Northeast Passages, which are mathematically the shortest path for many
  Asia ↔ Europe and Asia ↔ East-Coast-Americas routes but ice-blocked most
  of the year. Opt in to allow them.
- Validated against published reference distances on 12 real-world lanes
  (Shanghai-Rotterdam, NY-Rotterdam, Yokohama-LA, etc.) within ±10%.

### Known follow-ups
- The marnet is inlined in the bundle (~1.1 MB per build, ~2.2 MB total
  unpacked). Migrating to a single shared JSON asset is a non-breaking
  follow-up and would roughly halve published size.
- Multi-resolution networks (Eurostat ships 5 km / 10 km / 20 km / 50 km /
  100 km). Currently we only ship 100 km. Other resolutions could be loaded
  via a separate import path.

## 1.2.1 — 2022-07-12
First public release of the TypeScript port. See git history for prior 1.x
patch releases.
