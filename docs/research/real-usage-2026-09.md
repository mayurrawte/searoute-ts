# How searoute-ts is used in the wild (September 2026)

A read-only survey of public GitHub projects that depend on `searoute-ts`. The
aim is to drive changes from real usage rather than guesses. Nothing was
posted, starred, forked or opened on any external repository.

## Method

- Scope: the 13 dependent repositories supplied with the task, each
  shallow-cloned on 2026-09-23 (`git clone --depth 1`). Every link below is a
  permalink to the commit that was read.
- The extra `gh search code 'searoute-ts'` / `"from 'searoute-ts'"` sweeps
  were **not run**. This environment has no `gh` CLI, and its GitHub access is
  limited to this repository, so this survey covers only the 13 listed repos.
  Re-running the sweep with a normal `gh` login is a cheap way to extend it.
- For each repo I recorded the declared range and the lockfile-resolved
  version, every call site, every workaround and any misuse.
- Claims that depend on runtime behaviour were reproduced locally:
  - 1.2.1 failing to load on Node 22;
  - 2.3.0 loading under both `import` and `require`;
  - the short-hop numbers quoted below.
- **Independence:** `subhwastaken/3d-TruckLoad-Optimizer` is a copy of
  `ROHITH05012005/OPTILOAD`. Their `services/routing.ts` and
  `pages/SeaRoutePlanner.tsx` are byte-identical, so they count as **one**
  project in the rankings.
- `cookcaptain57-cpu/ecdis-route-finder` declares the dependency but never
  imports it.
- That leaves **11 independent projects that actually call the library**.

## Per-repo findings

Versions are shown as "declared → resolved". The resolved version comes from
the lockfile.

| Repo | What it does | Version | Calls | Workarounds / pain | Evidence |
|---|---|---|---|---|---|
| Abrechen2/TravStats | Self-hosted travel log (flights, cruises) | `^1.2.1` → 1.2.1 (lab tool only) | v1 `seaRoute(a, b, 'kilometers')` in a browser lab | **Dropped the library.** 1.x "ESM loader silently broke on Node ≥ 22". They copied the v1 network into their repo and wrote their own A\* router. The lab adds try/catch with straight-line, Bezier and raster fallbacks, a great-circle short-cut, and an island-clipping repair. They left on 2026-04-30, before 2.0.0 shipped. | [marnetGraph.ts:4-9][trav-graph], [marnetRouter.ts:5-11][trav-router], [hybrid.ts:120-121][trav-hybrid], [searouteTs.ts:48-58][trav-lab] |
| ChokePointMacro/Tradewinds | Supply-chain chokepoint closure simulator | `^2.0.0` → 2.0.0 | `seaRoute` with `restrictions`, `speedKnots`, `returnPassages`, `appendOriginDestination`, `maxSnapDistanceKm` | Lazy `import()` because of bundle size. Typed-error fallback to a great-circle line. They skip the library for Gulf origins when Hormuz is closed. Their own port table. No Taiwan Strait passage. | [searoute.ts:6-18][tw-lib], [SearouteRouteSource.ts:60-103][tw-src], [DATA_GAPS.md:11-13][tw-gaps] |
| Fares-Frini/eu-trip | Personal trip map (Leaflet) | `^2.2.0` → 2.2.0 | `seaRoute(a, b, { appendOriginDestination: true })`, geometry only | Catch-all returning `null`, then a straight line. A 1.x-style `feature?.geometry` null check that never runs on 2.x. | [routing.ts:38-47][eu] |
| ROHITH05012005/OPTILOAD | Logistics suite, sea-route planner | `^2.3.0` → 2.3.0 | `seaRoute` / `seaRouteMulti` with `units: 'kilometers'`, `speedKnots`, `antimeridian: 'unwrap'`, `restrictions`, `vesselDraftMeters` | The catch-all retry drops waypoints and keeps the draft block. **Misreads `appendOriginDestination`:** it measures the "last mile" from the raw destination, so the snap leg comes out as about 0. `durationHours` is recomputed, and overwritten with different speeds. | [routing.ts:498-503][opt-retry], [routing.ts:544-552][opt-snap], [SeaRoutePlanner.tsx:55-62][opt-eta] |
| imec-int/pill | Physical Internet Living Lab dashboard | `^1.2.1` → 1.2.1 | v1 `seaRoute(a, b)` | Forces a Cape Agulhas waypoint because it "does not support omitting the canal crossings" (now `restrictions` / `via`). Manual inland check (now `maxSnapDistanceKm`). v1 null check. Their own port table (Tanger Med has the wrong longitude sign). | [VoyageRouteLayer.tsx:50-93][pill], [constants.ts:5-88][pill-ports] |
| lxuuryy/aussie-dashboard | Logistics / container-tracking dashboard | `^1.2.1` → 1.2.1 | v1 `seaRoute(a, b, 'kilometers' \| 'miles')` in an API route and a client fallback | The client fallback uses a default import that 1.2.1 doesn't have. They match error messages the library never throws. They invent a duration (about 54 kn). Port coordinates come from an LLM. | [route.ts:123-187][aus-api], [VisiwiseTracker.jsx:163-187][aus-client] |
| okamoun/ConceptSailing | Catamaran charter itinerary builder (Greek islands) | `^2.3.0` → 2.3.0 | `seaRoute` with `searoute-ts/marnet-20km`, `maxSnapDistanceKm: 60`, `appendOriginDestination` | **Short hops:** the routed length is clamped to at least the straight line, and the path is hidden when it is shorter. Catch-all fallback to a straight line. `serverExternalPackages` plus lazy import to keep the network off the client. | [itinerary-utils.ts:34-52][cs-utils], [route.ts:60-98][cs-route], [next.config.mjs:3][cs-next] |
| subhwastaken/3d-TruckLoad-Optimizer | Copy of OPTILOAD | `^2.3.0` → 2.3.0 | identical | identical (counted once) | [routing.ts:544-552][truck] |
| TARUN062005/ROUTEGAURDIAN-PROJECT | Route-risk dashboard (road, air, sea) | `^1.1.0` → 1.2.1 | v1 `seaRoute(a, b, 'kilometers')`; a guarded `seaRouteAlternatives` call that 1.x can't reach | **Patches `node_modules`:** a `postinstall` hook writes an extensionless `dist/lib/utils` shim so 1.2.1 loads. Also a haversine length fallback, hand-computed duration, and nearest-port snapping against the NGA World Port Index. | [patch-searoute-ts.js:16][tarun-patch], [SeaRouteProvider.js:1-81][tarun-prov] |
| Vitali2011/quantika-demo | Freight-email triage and voyage-earnings (TCE) estimates | `^2.0.0` → 2.0.0 | `seaRoute(a, b, { units: 'nauticalmiles' })` as tier 3 of a distance lookup | Catch-all to `null`, then haversine. **Pre-checks endpoints within 50 nm** because they "would otherwise searoute to ~0nm". Their own UN/LOCODE table. Also runs the **Python `searoute`** service for `route_via` suez/cape/panama (now `via`). Their ADR says no maintained Node library existed. | [port-distances.ts:1450-1462][qk-short], [searoute-client.ts:28-40][qk-client], [knowledge-layer ADR:119-125][qk-adr] |
| anmolsaxena20/GeoSecure | Supply-chain risk agent (LangChain) | `^2.2.0` → 2.2.0 | `seaRoute(a, b)` (default nm) as an agent tool | Converts nm→km and nm→hours by hand (correct). 1.x-style null check. Errors returned to the LLM as a string. Ports come from ArcGIS WPI / Nominatim, with no snap limit. | [adaptive_procurement_orchestrator.js:379-395][geo] |
| cookcaptain57-cpu/ecdis-route-finder | Seafarer toolkit PWA | `^2.0.0`, no lockfile | **None**: declared but never imported | Uses its own waypoint graph, a Python service on Render ("searoute with land mask") and searoutes.com. It keeps a copy of the Eurostat 20 km network in `public/`. No reason is written down. | [api/route.js:5-7][ecdis] |
| xoriors/experimental (weather-voodoo) | Weather-window planner along routes | `^2.0.0` → 2.0.0 | `seaRoute(a, b, { units: 'kilometers' })` | Hand-rolled snap limit (`maxSnapDistanceKm` already existed). Typed catch (`SnapFailedError` / `NoRouteError`). **Prefers OSM ferry routes**, because "the Eurostat marnet is too coarse" for short coastal hops. | [sea-routing.ts:25-44][wv], [+server.ts:55-57][wv-ferry] |

**Lat/lon order:** no project passes `[lat, lon]` into the library. Every
`[lat, lng]` swap happens on *output*, for Leaflet or Google Maps, and is
correct. The one coordinate error found is a dropped minus sign in pill's own
port table. The README already says `[lon, lat]` everywhere, so no lon/lat
docs change is warranted.

**Units:** everyone who reads `length` reads it in the unit they asked for, or
as nm when they passed no unit. No misread units were found. The
hand-conversions are duplication, not bugs.

## Pain points, ranked by independent projects affected

| # | Pain point | Projects | Action |
|---|---|---|---|
| 1 | Catch-all try/catch with a straight or great-circle fallback | 10: TravStats, Tradewinds, eu-trip, OPTILOAD, pill, aussie, ConceptSailing, weather-voodoo, quantika, GeoSecure | **Not acted on.** Falling back is a sensible app choice, and 2.x already throws typed errors (only Tradewinds and weather-voodoo check the type). One common trigger (pain point 4) gets a clearer message in #38. |
| 2 | Own port coordinates or port lookup | 8: Tradewinds, eu-trip, OPTILOAD, pill, aussie, TARUN, quantika, GeoSecure | **Not acted on.** Five are on a version older than `searoute-ts/ports` (2.2). The newer ones need something else: TARUN wants the nearest port to a point, GeoSecure wants ports in a country, OPTILOAD geocodes place names. That is two or three distinct needs with one repo each, and a new API. |
| 3 | Duration or unit conversions done by hand | 5: TARUN, GeoSecure, OPTILOAD, aussie, ConceptSailing | **Not acted on.** Only GeoSecure and OPTILOAD are on 2.x and bypass `units` / `speedKnots`, and both compute correctly. The README already shows both options. |
| 4 | Short hops: the network is coarser than the trip | 4: ConceptSailing, quantika, weather-voodoo, TravStats | **#38** (clear `NoRouteError` when both points snap to the same vertex) and **#39** (docs: `length` can be below `greatCircleLength` on short hops). The coarseness is a data limit; `marnet-20km` exists since 2.3. |
| 5 | Lazy import or bundler config for bundle size | 4: Tradewinds, OPTILOAD, ConceptSailing, quantika | **Not acted on.** Nothing fails. The ESM build loads its data with a static `import` of the `.cjs`, which bundlers handle, and quantika needed no config. `serverExternalPackages` is optional. The README FAQ covers size and `loadNetwork`. |
| 6 | 1.x can't be loaded by plain Node (extensionless ESM imports under `"main"`) | 2 hit it (TravStats left, TARUN patches `dist`); 2 more still pinned to `^1.2.1` (pill, aussie) | **#40** (README FAQ with the exact error text and upgrade notes). The package-level fix is below. |
| 7 | 1.x-style `null` checks on 2.x | 2: eu-trip, GeoSecure | **#40** (the same FAQ entry). The checks are harmless dead code. |
| 8 | `length` excludes the snap legs, even with `appendOriginDestination` | 2: OPTILOAD, ConceptSailing | **#39** (README: what `length` covers, and a door-to-door example). |
| 9 | Hand-rolled snap-distance limit | 1 on 2.x (weather-voodoo); pill and TravStats on 1.x, where the option did not exist | **Not acted on.** `maxSnapDistanceKm` is documented. |
| 10 | Forcing or avoiding a canal | 2: pill (1.x Cape waypoint hack), quantika (Python `route_via`) | **No action needed.** `restrictions` (2.0) and `via` (2.3) already do this. Both repos are on older versions. |
| 11 | Taiwan Strait not a restrictable passage | 1: Tradewinds | **Not acted on.** A one-repo feature request. |
| 12 | `seaRouteAlternatives` / `seaRouteMulti` don't take a units *string* like `seaRoute` does | 1: TARUN (latent, since the call can't run on 1.2.1) | **Not acted on.** In plain JS, `seaRouteAlternatives(a, b, 'kilometers')` spreads the string as options and silently returns nm. TypeScript rejects it. A one-line `typeof === 'string'` normalisation would fix it if a second report turns up. |
| 13 | Locked to 2.0.0, before the 2.0.1 fix for bbox-detected passages (`ormuz`, `bosporus`) | 3: Tradewinds, quantika, weather-voodoo | **No action.** `^2.0.0` ranges pick up the fix on the next reinstall. Tradewinds' Hormuz closure is the one likely to be affected today. |

## Fix PRs from this survey

- **#38**: `fix: explain NoRouteError when both points snap to the same vertex`
  (pain point 4; code + test).
- **#39**: `docs: say that length excludes the snap legs, and how to add them`
  (pain points 4 and 8).
- **#40**: `docs: FAQ entry for the 1.x "dist/lib/utils" load error and upgrading`
  (pain points 6 and 7).

## Right fixes deliberately not made

These were left out because they change behaviour or add API:

- **Same-vertex hops.** Return a direct in-water segment, or a zero-length
  route, instead of throwing. That is what quantika and ConceptSailing
  actually want. But it changes behaviour for callers who rely on the throw,
  so #38 only improves the message.
- **Door-to-door length.** Make `length` include the snap legs, or add a
  `totalLength`. Changing `length` is breaking. A new property is new API
  that only two repos would use, and both already work around it in one line
  (now documented in #39).
- **Fix 1.x at the source.** The owner could publish a 1.2.2 that fixes the
  `dist` layout, or, more cheaply, run
  `npm deprecate searoute-ts@"<2" "1.x cannot be loaded by Node ESM/CJS; upgrade to ^2 (see README FAQ)"`.
  That shows the pointer on every `npm install` of 1.x. Both are publish
  actions and were left to the owner.

## Worth knowing, not code

- Two projects believed there was no maintained Node sea-routing library:
  quantika's ADR ([knowledge-layer ADR:119-125][qk-adr]) and TravStats
  ("abandoned"). Both reached that view while 1.x was the latest release.
  Discoverability, not API, is the gap there.
- ecdis-route-finder keeps its own copy of the Eurostat 20 km network and
  still uses a Python service. The likely draw is vessel-dimension-aware
  routing (draft, beam, LOA), but their repo does not say so.

[trav-graph]: https://github.com/Abrechen2/TravStats/blob/4231f3cc5304c357f56720c91e4fe4f0f15a594a/backend/src/services/marnet/marnetGraph.ts#L4-L9
[trav-router]: https://github.com/Abrechen2/TravStats/blob/4231f3cc5304c357f56720c91e4fe4f0f15a594a/backend/src/services/marnet/marnetRouter.ts#L5-L11
[trav-hybrid]: https://github.com/Abrechen2/TravStats/blob/4231f3cc5304c357f56720c91e4fe4f0f15a594a/tools/sea-route-lab/src/methods/hybrid.ts#L120-L121
[trav-lab]: https://github.com/Abrechen2/TravStats/blob/4231f3cc5304c357f56720c91e4fe4f0f15a594a/tools/sea-route-lab/src/methods/searouteTs.ts#L48-L58
[tw-lib]: https://github.com/ChokePointMacro/Tradewinds/blob/dece9f9af476fc7f7272ba81a53c119cc53bffa9/src/lib/routing/searoute.ts#L6-L18
[tw-src]: https://github.com/ChokePointMacro/Tradewinds/blob/dece9f9af476fc7f7272ba81a53c119cc53bffa9/src/data/adapters/live/SearouteRouteSource.ts#L60-L103
[tw-gaps]: https://github.com/ChokePointMacro/Tradewinds/blob/dece9f9af476fc7f7272ba81a53c119cc53bffa9/DATA_GAPS.md#L11-L13
[eu]: https://github.com/Fares-Frini/eu-trip/blob/ae40b17d4f70f938393210b29f9ecc3f2e92d787/lib/routing.ts#L38-L47
[opt-retry]: https://github.com/ROHITH05012005/OPTILOAD/blob/748bd1fb5f6e42a6609112b8d51a1ee5b0f4d7a4/services/routing.ts#L498-L503
[opt-snap]: https://github.com/ROHITH05012005/OPTILOAD/blob/748bd1fb5f6e42a6609112b8d51a1ee5b0f4d7a4/services/routing.ts#L544-L552
[opt-eta]: https://github.com/ROHITH05012005/OPTILOAD/blob/748bd1fb5f6e42a6609112b8d51a1ee5b0f4d7a4/pages/SeaRoutePlanner.tsx#L55-L62
[truck]: https://github.com/subhwastaken/3d-TruckLoad-Optimizer/blob/57bbbed3a60e763dc200e79ad20166123752d3a9/services/routing.ts#L544-L552
[pill]: https://github.com/imec-int/pill/blob/0696fc7455a2073ee136e27f2479aa7a550fbf00/src/components/map/vessel/layers/VoyageRouteLayer.tsx#L50-L93
[pill-ports]: https://github.com/imec-int/pill/blob/0696fc7455a2073ee136e27f2479aa7a550fbf00/src/components/map/vessel/layers/constants.ts#L5-L88
[aus-api]: https://github.com/lxuuryy/aussie-dashboard/blob/c7285b2092a91972268158de57df5a13a819faec/app/api/searoute/route.ts#L123-L187
[aus-client]: https://github.com/lxuuryy/aussie-dashboard/blob/c7285b2092a91972268158de57df5a13a819faec/app/(components)/VisiwiseTracker.jsx#L163-L187
[cs-utils]: https://github.com/okamoun/ConceptSailing/blob/09a8035357cb26b290d4c95961a6050912ca761b/app/client-space/%5Btoken%5D/itinerary/itinerary-utils.ts#L34-L52
[cs-route]: https://github.com/okamoun/ConceptSailing/blob/09a8035357cb26b290d4c95961a6050912ca761b/app/api/itinerary-route/route.ts#L60-L98
[cs-next]: https://github.com/okamoun/ConceptSailing/blob/09a8035357cb26b290d4c95961a6050912ca761b/next.config.mjs#L3
[tarun-patch]: https://github.com/TARUN062005/ROUTEGAURDIAN-PROJECT/blob/1e707f97e5e1c899595bac7b2aae2a098f5ed26e/server/scripts/patch-searoute-ts.js#L16
[tarun-prov]: https://github.com/TARUN062005/ROUTEGAURDIAN-PROJECT/blob/1e707f97e5e1c899595bac7b2aae2a098f5ed26e/server/services/SeaRouteProvider.js#L1-L81
[qk-short]: https://github.com/Vitali2011/quantika-demo/blob/ad1fbe38f69714aa190b750eec553e666c099771/lib/sailing/port-distances.ts#L1450-L1462
[qk-client]: https://github.com/Vitali2011/quantika-demo/blob/ad1fbe38f69714aa190b750eec553e666c099771/lib/sailing/searoute-client.ts#L28-L40
[qk-adr]: https://github.com/Vitali2011/quantika-demo/blob/ad1fbe38f69714aa190b750eec553e666c099771/docs/adr/2026-05-06-knowledge-layer.md#L119-L125
[geo]: https://github.com/anmolsaxena20/GeoSecure/blob/236980203d2fcfdd73a182489af2556cdec70609/ai/agents/adaptive_procurement_orchestrator.js#L379-L395
[ecdis]: https://github.com/cookcaptain57-cpu/ecdis-route-finder/blob/a19d8fc7bdddde41a9fbd0f998cb0bfc637c3fa5/api/route.js#L5-L7
[wv]: https://github.com/xoriors/experimental/blob/e5ada969d2425877b1f5a92c3a64645504212fc5/weather-voodoo/src/lib/server/sea-routing.ts#L25-L44
[wv-ferry]: https://github.com/xoriors/experimental/blob/e5ada969d2425877b1f5a92c3a64645504212fc5/weather-voodoo/src/routes/api/route/%2Bserver.ts#L55-L57
