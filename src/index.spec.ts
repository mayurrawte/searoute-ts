import test from 'ava';
import type { Feature, Point } from 'geojson';

import {
  CANAL_MAX_DRAFT_M,
  clearFinderCache,
  DEFAULT_MARNET,
  loadNetwork,
  NoRouteError,
  seaRoute,
  seaRouteAlternatives,
  seaRouteMulti,
  SnapFailedError,
  UnknownPortError,
} from './index';

function pt(lon: number, lat: number): Feature<Point> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [lon, lat] },
  };
}

const NYC = pt(-74.04, 40.69);
const LONDON = pt(-0.13, 51.5);
const SHANGHAI = pt(121.5, 31.0);
const ROTTERDAM = pt(4.4, 51.9);
const SINGAPORE = pt(103.8, 1.3);
const LA = pt(-118.3, 33.7);
const YOKOHAMA = pt(139.6, 35.4);
const HONOLULU = pt(-157.8, 21.3);
const SYDNEY = pt(151.2, -33.9);
const VANCOUVER = pt(-123.1, 49.3);
const MUMBAI = pt(72.9, 19.0);
const LISBON = pt(-9.14, 38.7);
const DOVER_STRAIT_WEST = pt(1.45, 50.94);
const DOVER_STRAIT_EAST = pt(2.2, 51.34);
const BARCELONA = pt(2.1734, 41.3851);
const MARSEILLE = pt(5.3698, 43.2965);
const SHANGHAI_OUTER = pt(121.545763, 31.254191);
const KYUSHU = pt(130.392684, 33.628909);
const ANGOLA_COAST = pt(12.33596, -6.11957);
const CONGO_COAST = pt(11.881, -4.893);
const WEST_MED_EDGE_NORTH = pt(5.63, 40.76);
const WEST_MED_EDGE_SOUTH = pt(5.29, 40.04);

test.beforeEach(() => clearFinderCache());

// ── Basic API ───────────────────────────────────────────────────────────────

test('returns a LineString feature with length in nautical miles by default', (t) => {
  const route = seaRoute(NYC, LONDON);
  t.is(route.geometry.type, 'LineString');
  t.is(route.properties.units, 'nauticalmiles');
  t.true(route.properties.length > 2500);
  t.true(route.properties.length < 4500);
});

test('accepts a Position array as input', (t) => {
  const route = seaRoute([-74.04, 40.69], [-0.13, 51.5]);
  t.is(route.geometry.type, 'LineString');
  t.true(route.geometry.coordinates.length >= 2);
});

test('accepts a bare Point geometry', (t) => {
  const route = seaRoute(NYC.geometry, LONDON.geometry);
  t.true(route.geometry.coordinates.length >= 2);
});

test('legacy units-as-string argument still works', (t) => {
  const route = seaRoute(NYC, LONDON, 'kilometers');
  t.is(route.properties.units, 'kilometers');
  t.true(route.properties.length > 5000);
});

test('options object selects units and computes duration from speed', (t) => {
  const route = seaRoute(NYC, LONDON, { units: 'kilometers', speedKnots: 20 });
  t.is(route.properties.units, 'kilometers');
  t.true(route.properties.length > 5000);
  t.truthy(route.properties.durationHours);
  t.true(route.properties.durationHours! > 100);
  t.true(route.properties.durationHours! < 400);
});

test('nautical-mile conversion is correct (sanity check vs km)', (t) => {
  const nm = seaRoute(NYC, LONDON, { units: 'nauticalmiles' });
  const km = seaRoute(NYC, LONDON, { units: 'kilometers' });
  const ratio = km.properties.length / nm.properties.length;
  // 1 nm = 1.852 km exactly
  t.true(Math.abs(ratio - 1.852) < 0.01, `nm→km ratio was ${ratio}, expected ~1.852`);
});

// ── Published-distance sanity checks ────────────────────────────────────────
//
// Distance bounds come from public reference sources (Searoutes API, Sea-Distances.org,
// industry reference distances) and the values returned by the Eurostat Java searoute
// at the same resolution. ±10% tolerance is intentional — this network is for
// visualisation, not navigation.

const expect = (
  t: import('ava').ExecutionContext,
  label: string,
  origin: Feature<Point>,
  dest: Feature<Point>,
  opts: Parameters<typeof seaRoute>[2],
  loKm: number,
  hiKm: number,
) => {
  const route = seaRoute(origin, dest, { units: 'kilometers', ...(opts as object) });
  const len = route.properties.length;
  t.true(len >= loKm && len <= hiKm, `${label}: ${len.toFixed(0)} km not in [${loKm}, ${hiKm}]`);
};

const expectShortRoute = (
  t: import('ava').ExecutionContext,
  label: string,
  origin: Feature<Point>,
  dest: Feature<Point>,
  opts: Parameters<typeof seaRoute>[2],
  loKm: number,
  hiKm: number,
): ReturnType<typeof seaRoute> => {
  const route = seaRoute(origin, dest, { units: 'kilometers', ...(opts as object) });
  const len = route.properties.length;
  t.true(len > 0, `${label}: expected a non-zero route length`);
  t.true(len >= loKm && len <= hiKm, `${label}: ${len.toFixed(0)} km not in [${loKm}, ${hiKm}]`);
  return route;
};

test('Shanghai → Rotterdam ≈ 19 000–21 000 km via Suez (default)', (t) => {
  expect(t, 'Shanghai-Rotterdam', SHANGHAI, ROTTERDAM, {}, 19000, 21000);
});

test('Singapore → Rotterdam ≈ 14 500–16 500 km via Suez', (t) => {
  expect(t, 'Singapore-Rotterdam', SINGAPORE, ROTTERDAM, {}, 14500, 16500);
});

test('Mumbai → Rotterdam ≈ 11 000–13 000 km via Suez', (t) => {
  expect(t, 'Mumbai-Rotterdam', MUMBAI, ROTTERDAM, {}, 11000, 13000);
});

test('Yokohama → LA ≈ 8 500–10 000 km trans-Pacific', (t) => {
  expect(t, 'Yokohama-LA', YOKOHAMA, LA, {}, 8500, 10000);
});

test('Honolulu → Yokohama ≈ 6 000–7 500 km', (t) => {
  expect(t, 'Honolulu-Yokohama', HONOLULU, YOKOHAMA, {}, 6000, 7500);
});

test('Sydney → Vancouver ≈ 12 000–14 500 km', (t) => {
  expect(t, 'Sydney-Vancouver', SYDNEY, VANCOUVER, {}, 12000, 14500);
});

test('NY → Rotterdam ≈ 5 800–6 700 km', (t) => {
  expect(t, 'NY-Rotterdam', NYC, ROTTERDAM, {}, 5800, 6700);
});

test('NY → Lisbon ≈ 5 000–5 800 km', (t) => {
  expect(t, 'NY-Lisbon', NYC, LISBON, {}, 5000, 5800);
});

test('Singapore → LA ≈ 14 000–15 000 km via Panama', (t) => {
  expect(t, 'Singapore-LA', SINGAPORE, LA, {}, 14000, 15000);
});

test('NY → LA ≈ 8 500–9 500 km via Panama', (t) => {
  expect(t, 'NY-LA', NYC, LA, {}, 8500, 9500);
});

// ── Short-hop regression checks ─────────────────────────────────────────────

test('Dover Strait edge short hop stays on the labelled crossing', (t) => {
  const route = expectShortRoute(
    t,
    'Dover Strait edge',
    DOVER_STRAIT_WEST,
    DOVER_STRAIT_EAST,
    { returnPassages: true },
    50,
    90,
  );
  t.true(route.properties.passages?.includes('dover'), 'should traverse the Dover passage');
  t.true(route.properties.originSnapKm < 5);
  t.true(route.properties.destinationSnapKm < 5);
});

test('Barcelona → Marseille returns a bounded intra-Mediterranean route', (t) => {
  const route = expectShortRoute(t, 'Barcelona-Marseille', BARCELONA, MARSEILLE, {}, 300, 450);
  t.true(route.properties.detourRatio > 1.0 && route.properties.detourRatio < 1.25);
  const [minLon, minLat, maxLon, maxLat] = route.properties.bbox;
  t.true(minLon >= 2 && maxLon <= 6, `bbox lon ${minLon}..${maxLon} should stay in west Med`);
  t.true(minLat >= 40 && maxLat <= 44, `bbox lat ${minLat}..${maxLat} should stay in west Med`);
});

test('same-edge short hop returns a non-zero route instead of collapsing', (t) => {
  const route = expectShortRoute(
    t,
    'same-edge west Mediterranean',
    WEST_MED_EDGE_NORTH,
    WEST_MED_EDGE_SOUTH,
    {},
    70,
    100,
  );
  t.is(route.geometry.coordinates.length, 2);
  t.true(route.properties.detourRatio > 0.95 && route.properties.detourRatio < 1.05);
  t.true(route.properties.originSnapKm < 1);
  t.true(route.properties.destinationSnapKm < 1);
});

test('Shanghai → Kyushu stays in the East China Sea corridor', (t) => {
  const route = expectShortRoute(t, 'Shanghai-Kyushu', SHANGHAI_OUTER, KYUSHU, {}, 800, 1050);
  t.true(route.properties.detourRatio > 1.0 && route.properties.detourRatio < 1.2);
  t.true(route.properties.originSnapKm < 20);
  t.true(route.properties.destinationSnapKm < 100);
  const [minLon, minLat, maxLon, maxLat] = route.properties.bbox;
  t.true(minLon >= 121 && maxLon <= 131, `bbox lon ${minLon}..${maxLon} jumped out of corridor`);
  t.true(minLat >= 30 && maxLat <= 35, `bbox lat ${minLat}..${maxLat} jumped out of corridor`);
});

test('linked Angola → Congo coastal short hop returns a plausible non-zero route', (t) => {
  const route = expectShortRoute(t, 'Angola-Congo coast', ANGOLA_COAST, CONGO_COAST, {}, 150, 230);
  t.true(route.properties.detourRatio > 1.0 && route.properties.detourRatio < 1.5);
  t.true(route.properties.originSnapKm < 25);
  t.true(route.properties.destinationSnapKm < 25);
});

// ── Restrictions ────────────────────────────────────────────────────────────

test('blocking Suez+Bab-el-Mandeb on Shanghai→Rotterdam forces a longer path', (t) => {
  const direct = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers' });
  const blocked = seaRoute(SHANGHAI, ROTTERDAM, {
    units: 'kilometers',
    restrictions: ['suez', 'babelmandeb'],
  });
  t.true(
    blocked.properties.length > direct.properties.length + 4000,
    `blocked ${blocked.properties.length} should be ≥ direct ${direct.properties.length} + 4000`,
  );
});

test('babalmandab is accepted as an alias for babelmandeb', (t) => {
  clearFinderCache();
  const a = seaRoute(SHANGHAI, ROTTERDAM, {
    units: 'kilometers',
    restrictions: ['suez', 'babelmandeb'],
  });
  clearFinderCache();
  const b = seaRoute(SHANGHAI, ROTTERDAM, {
    units: 'kilometers',
    restrictions: ['suez', 'babalmandab'],
  });
  t.is(a.properties.length, b.properties.length);
});

test('blocking Panama on NY→LA forces routing around Cape Horn (much longer)', (t) => {
  clearFinderCache();
  const direct = seaRoute(NYC, LA, { units: 'kilometers', returnPassages: true });
  clearFinderCache();
  const blocked = seaRoute(NYC, LA, {
    units: 'kilometers',
    restrictions: ['panama'],
    returnPassages: true,
  });
  t.true((direct.properties.passages ?? []).includes('panama'), 'baseline should use Panama');
  t.true(
    blocked.properties.length > direct.properties.length + 10000,
    `blocked ${blocked.properties.length} should be ≥ direct ${direct.properties.length} + 10000`,
  );
  t.true(
    (blocked.properties.passages ?? []).includes('magellan'),
    'forced route should use the Strait of Magellan',
  );
});

test('returnPassages flags traversed straits on a default Asia→Europe route', (t) => {
  const route = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers', returnPassages: true });
  const p = new Set(route.properties.passages ?? []);
  t.true(p.has('suez'), 'should traverse Suez');
  t.true(p.has('malacca'), 'should traverse Malacca');
  t.true(p.has('gibraltar'), 'should traverse Gibraltar');
});

// ── Arctic gating ───────────────────────────────────────────────────────────

test('arctic passages are blocked by default', (t) => {
  const route = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers', returnPassages: true });
  const p = new Set(route.properties.passages ?? []);
  t.false(p.has('northwest'), 'NWP should not be used by default');
  t.false(p.has('northeast'), 'NEP should not be used by default');
});

test('allowArctic:true permits NEP for Asia→Europe and shortens the route', (t) => {
  clearFinderCache();
  const closed = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers' });
  clearFinderCache();
  const open = seaRoute(SHANGHAI, ROTTERDAM, {
    units: 'kilometers',
    allowArctic: true,
    returnPassages: true,
  });
  t.true(open.properties.length < closed.properties.length, 'Arctic should be shorter');
  t.true((open.properties.passages ?? []).includes('northeast'), 'should use NEP');
});

// ── via (forced passages) ───────────────────────────────────────────────────

test('via: [panama] forces Shanghai→Rotterdam across the Pacific + Panama (not Suez)', (t) => {
  const direct = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers', returnPassages: true });
  const forced = seaRoute(SHANGHAI, ROTTERDAM, {
    units: 'kilometers',
    via: ['panama'],
    returnPassages: true,
  });
  const p = new Set(forced.properties.passages ?? []);
  t.true(p.has('panama'), `should traverse Panama, got ${[...p]}`);
  t.false(p.has('suez'), 'should not use Suez when forced via Panama');
  // Pacific + Panama + Atlantic is far longer than the default Suez routing.
  t.true(
    forced.properties.length > direct.properties.length,
    `forced ${forced.properties.length} should exceed direct ${direct.properties.length}`,
  );
  // Sweeps into the western hemisphere on the trans-Pacific crossing.
  t.true(
    forced.properties.bbox[0] < -100,
    `bbox should reach the Americas: ${forced.properties.bbox}`,
  );
});

test('via: [magellan] forces NY→LA around South America instead of Panama', (t) => {
  clearFinderCache();
  const direct = seaRoute(NYC, LA, { units: 'kilometers', returnPassages: true });
  const forced = seaRoute(NYC, LA, {
    units: 'kilometers',
    via: ['magellan'],
    returnPassages: true,
  });
  t.true((direct.properties.passages ?? []).includes('panama'), 'baseline uses Panama');
  const p = new Set(forced.properties.passages ?? []);
  t.true(p.has('magellan'), `should traverse Magellan, got ${[...p]}`);
  // Rounding Cape Horn is thousands of km longer than the Panama shortcut,
  // which proves the route went around South America rather than transiting
  // the canal. (The Pacific leg still skirts Panama's Pacific approaches, so
  // the bbox-based passage flag can legitimately include 'panama'.)
  t.true(
    forced.properties.length > direct.properties.length + 10000,
    `forced ${forced.properties.length} should be much longer than direct ${direct.properties.length}`,
  );
});

test('via: [suez] keeps Shanghai→Rotterdam on the Suez routing', (t) => {
  const forced = seaRoute(SHANGHAI, ROTTERDAM, {
    units: 'kilometers',
    via: ['suez'],
    returnPassages: true,
  });
  t.true((forced.properties.passages ?? []).includes('suez'));
});

test('via: [northeast] routes through the NEP without needing allowArctic', (t) => {
  // Arctic passages are blocked by default, but a passage named in `via` must
  // not be blocked out from under the requirement.
  const forced = seaRoute(SHANGHAI, ROTTERDAM, {
    units: 'kilometers',
    via: ['northeast'],
    returnPassages: true,
  });
  t.true(
    (forced.properties.passages ?? []).includes('northeast'),
    `should use the NEP, got ${forced.properties.passages}`,
  );
});

test('via keeps the great-circle reference measured origin→destination', (t) => {
  const direct = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers' });
  const forced = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers', via: ['panama'] });
  t.is(
    Math.round(forced.properties.greatCircleLength),
    Math.round(direct.properties.greatCircleLength),
    'great-circle length should reference origin→destination, not the via waypoints',
  );
});

test('via and restrictions in contradiction throw NoRouteError', (t) => {
  t.throws(() => seaRoute(SHANGHAI, ROTTERDAM, { via: ['suez'], restrictions: ['suez'] }), {
    instanceOf: NoRouteError,
  });
});

test('via/restrictions contradiction is detected across passage aliases', (t) => {
  t.throws(
    () => seaRoute(SHANGHAI, ROTTERDAM, { via: ['babalmandab'], restrictions: ['babelmandeb'] }),
    { instanceOf: NoRouteError },
  );
});

// ── Output shape ────────────────────────────────────────────────────────────

test('appendOriginDestination adds endpoints but does not change length', (t) => {
  const plain = seaRoute(NYC, LONDON, { units: 'kilometers' });
  const appended = seaRoute(NYC, LONDON, { units: 'kilometers', appendOriginDestination: true });
  t.is(plain.properties.length, appended.properties.length);
  t.is(appended.geometry.coordinates.length, plain.geometry.coordinates.length + 2);
  t.deepEqual(appended.geometry.coordinates[0], NYC.geometry.coordinates);
  t.deepEqual(
    appended.geometry.coordinates[appended.geometry.coordinates.length - 1],
    LONDON.geometry.coordinates,
  );
});

test('NoRouteError is exported', (t) => {
  t.true(new NoRouteError() instanceof Error);
  t.is(new NoRouteError().name, 'NoRouteError');
});

test('throws NoRouteError when a restriction severs the only path', (t) => {
  // The Bosporus is the Black Sea's only exit — blocking it strands Odessa.
  const ODESSA = pt(30.72, 46.35);
  t.throws(() => seaRoute(ODESSA, ROTTERDAM, { restrictions: ['bosporus'] }), {
    instanceOf: NoRouteError,
  });
});

test('returnPassages reports narrow straits crossed mid-edge (bosporus)', (t) => {
  // The network edge through the Bosporus is long; its vertices sit outside
  // the strait bbox, so detection must test the segment, not just the points.
  const ODESSA = pt(30.72, 46.35);
  const r = seaRoute(ODESSA, ROTTERDAM, { returnPassages: true });
  t.true(r.properties.passages?.includes('bosporus'), `got: ${r.properties.passages}`);
});

// ── Properties: bbox, snap, great-circle, detour ────────────────────────────

test('route properties include bbox, greatCircleLength, detourRatio, snap km', (t) => {
  const r = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers' });
  t.is(r.properties.bbox.length, 4);
  const [minLon, minLat, maxLon, maxLat] = r.properties.bbox;
  t.true(minLon < maxLon && minLat < maxLat);
  t.true(r.properties.greatCircleLength > 8000 && r.properties.greatCircleLength < 9500);
  // Shanghai→Rotterdam great-circle ≈ 9000 km, sea route ≈ 19 700 km → ratio ≈ 2.2
  t.true(r.properties.detourRatio > 1.5 && r.properties.detourRatio < 3);
  t.true(r.properties.originSnapKm >= 0);
  t.true(r.properties.destinationSnapKm >= 0);
});

test('great-circle length scales with units', (t) => {
  const km = seaRoute(NYC, LONDON, { units: 'kilometers' });
  const nm = seaRoute(NYC, LONDON, { units: 'nauticalmiles' });
  const ratio = km.properties.greatCircleLength / nm.properties.greatCircleLength;
  t.true(Math.abs(ratio - 1.852) < 0.01);
});

// ── maxSnapDistanceKm ───────────────────────────────────────────────────────

test('maxSnapDistanceKm rejects a far-from-network input', (t) => {
  // [100, 100] is an invalid latitude; nearest legal point is hundreds of km away.
  const err = t.throws(() => seaRoute([0, 0], [100, 100], { maxSnapDistanceKm: 50 }), {
    instanceOf: SnapFailedError,
  });
  t.is(err?.side, 'destination');
  t.true((err?.distanceKm ?? 0) > 50);
});

test('maxSnapDistanceKm allows inputs within the limit', (t) => {
  // NYC sits within ~50 km of the marnet
  t.notThrows(() => seaRoute(NYC, LONDON, { maxSnapDistanceKm: 50 }));
});

// ── Vessel draft auto-restrict ──────────────────────────────────────────────

test('vesselDraftMeters > 15.2 m auto-blocks Panama', (t) => {
  clearFinderCache();
  const ulcs = seaRoute(NYC, LA, {
    units: 'kilometers',
    vesselDraftMeters: 16,
    returnPassages: true,
  });
  t.false((ulcs.properties.passages ?? []).includes('panama'), 'Panama should be blocked');
});

test('vesselDraftMeters within limit lets Panama through', (t) => {
  clearFinderCache();
  const panamax = seaRoute(NYC, LA, {
    units: 'kilometers',
    vesselDraftMeters: 12,
    returnPassages: true,
  });
  t.true((panamax.properties.passages ?? []).includes('panama'));
});

test('CANAL_MAX_DRAFT_M exposes the canal limits', (t) => {
  t.is(CANAL_MAX_DRAFT_M.panama, 15.2);
  t.is(CANAL_MAX_DRAFT_M.suez, 20.1);
});

// ── Multi-leg waypoints ─────────────────────────────────────────────────────

test('seaRouteMulti concatenates legs through waypoints', (t) => {
  const m = seaRouteMulti([SHANGHAI, SINGAPORE, MUMBAI, ROTTERDAM], { units: 'kilometers' });
  t.is(m.geometry.type, 'LineString');
  // Total length should be larger than the direct shortest leg
  const direct = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers' });
  t.true(m.properties.length >= direct.properties.length);
});

test('seaRouteMulti requires at least two waypoints', (t) => {
  t.throws(() => seaRouteMulti([SHANGHAI], {}), {
    message: /at least two waypoints/,
  });
});

test('seaRouteMulti propagates returnPassages across legs', (t) => {
  const m = seaRouteMulti([SHANGHAI, SINGAPORE, ROTTERDAM], {
    units: 'kilometers',
    returnPassages: true,
  });
  t.truthy(m.properties.passages);
  t.true((m.properties.passages ?? []).includes('malacca'));
});

// ── K-shortest alternatives ─────────────────────────────────────────────────

test('seaRouteAlternatives returns up to k distinct routes sorted by length', (t) => {
  const alts = seaRouteAlternatives(SHANGHAI, ROTTERDAM, { units: 'kilometers', k: 4 });
  t.true(alts.length >= 2, 'should return at least 2 alternatives');
  t.true(alts.length <= 4, 'should not exceed k');
  for (let i = 1; i < alts.length; i++) {
    t.true(
      alts[i].properties.length >= alts[i - 1].properties.length,
      'should be sorted by length ascending',
    );
  }
  // First alternative should always be the baseline
  t.is(alts[0].properties.variant, 'baseline');
  for (const a of alts) {
    t.truthy(a.properties.variant);
  }
});

test('seaRouteAlternatives filters near-duplicate-length routes', (t) => {
  const alts = seaRouteAlternatives(NYC, LONDON, {
    units: 'kilometers',
    k: 4,
    similarityThreshold: 0.5, // very aggressive — should collapse to 1
  });
  t.is(alts.length, 1);
});

// ── Bundled network asset ────────────────────────────────────────────────────

test('DEFAULT_MARNET loads the shared network asset', (t) => {
  // The network no longer lives inlined in the compiled module; it is loaded at
  // runtime from the single shared data/marnet.cjs asset. If that resolution
  // ever breaks, DEFAULT_MARNET comes back empty (or the import throws).
  t.is(DEFAULT_MARNET.type, 'FeatureCollection');
  t.true(DEFAULT_MARNET.features.length > 9000);
  t.true(DEFAULT_MARNET.features.every((f) => f.geometry.type === 'LineString'));
  // The Eurostat network carries native `pass` labels on canal/strait edges.
  t.true(DEFAULT_MARNET.features.some((f) => typeof f.properties?.pass === 'string'));
});
// ── Antimeridian output ──────────────────────────────────────────────────────

function maxLonJump(coords: number[][]): number {
  let max = 0;
  for (let i = 1; i < coords.length; i++) {
    max = Math.max(max, Math.abs(coords[i][0] - coords[i - 1][0]));
  }
  return max;
}

test('default output leaves a trans-Pacific route wrapped (big longitude jump)', (t) => {
  const r = seaRoute(YOKOHAMA, LA, { units: 'kilometers' });
  t.is(r.geometry.type, 'LineString');
  // Wrapped to [-180, 180] it jumps ~360° across the dateline mid-Pacific.
  t.true(maxLonJump(r.geometry.coordinates) > 300);
});

test("antimeridian 'unwrap' keeps a continuous LineString across the dateline", (t) => {
  const def = seaRoute(YOKOHAMA, LA, { units: 'kilometers' });
  const r = seaRoute(YOKOHAMA, LA, { units: 'kilometers', antimeridian: 'unwrap' });
  t.is(r.geometry.type, 'LineString');
  // No consecutive step jumps the dateline any more.
  t.true(maxLonJump(r.geometry.coordinates) < 180);
  // Some longitude runs past +180 (unwrapped continuation of the Pacific).
  t.true(r.geometry.coordinates.some((c) => c[0] > 180));
  // Same point count and latitudes; same computed length.
  t.is(r.geometry.coordinates.length, def.geometry.coordinates.length);
  t.deepEqual(
    r.geometry.coordinates.map((c) => c[1]),
    def.geometry.coordinates.map((c) => c[1]),
  );
  t.is(Math.round(r.properties.length), Math.round(def.properties.length));
});

test("antimeridian 'split' returns a MultiLineString cut at ±180°", (t) => {
  const def = seaRoute(YOKOHAMA, LA, { units: 'kilometers' });
  const r = seaRoute(YOKOHAMA, LA, { units: 'kilometers', antimeridian: 'split' });
  t.is(r.geometry.type, 'MultiLineString');
  const parts = r.geometry.coordinates;
  t.true(parts.length >= 2, 'a trans-Pacific route splits into at least two parts');

  for (const part of parts) {
    for (const [lon] of part) t.true(Math.abs(lon) <= 180 + 1e-9, `lon ${lon} within ±180`);
    t.true(maxLonJump(part) < 180, 'no part jumps the dateline internally');
  }

  // Each cut meets the dateline at ±180° with a shared latitude.
  for (let i = 0; i < parts.length - 1; i++) {
    const end = parts[i][parts[i].length - 1];
    const start = parts[i + 1][0];
    t.is(Math.abs(end[0]), 180);
    t.is(Math.abs(start[0]), 180);
    t.true(Math.abs(end[1] - start[1]) < 1e-9, 'cut latitude is continuous');
  }

  // The representation change does not alter the computed length.
  t.is(Math.round(r.properties.length), Math.round(def.properties.length));
});

test('antimeridian options do not affect a route that never crosses the dateline', (t) => {
  const def = seaRoute(NYC, LONDON, { units: 'kilometers' });
  const unwrapped = seaRoute(NYC, LONDON, { units: 'kilometers', antimeridian: 'unwrap' });
  t.deepEqual(unwrapped.geometry.coordinates, def.geometry.coordinates);

  const split = seaRoute(NYC, LONDON, { units: 'kilometers', antimeridian: 'split' });
  t.is(split.geometry.type, 'MultiLineString');
  t.is(split.geometry.coordinates.length, 1);
  t.deepEqual(split.geometry.coordinates[0], def.geometry.coordinates);
});

test('seaRouteMulti honours antimeridian: split across legs', (t) => {
  const r = seaRouteMulti([YOKOHAMA, LA, NYC], { units: 'kilometers', antimeridian: 'split' });
  t.is(r.geometry.type, 'MultiLineString');
  t.true(r.geometry.coordinates.length >= 2);
  for (const part of r.geometry.coordinates) {
    for (const [lon] of part) t.true(Math.abs(lon) <= 180 + 1e-9);
  }
});

test('seaRouteAlternatives ignores antimeridian and returns LineStrings', (t) => {
  const alts = seaRouteAlternatives(YOKOHAMA, LA, {
    units: 'kilometers',
    antimeridian: 'split',
  });
  for (const a of alts) t.is(a.geometry.type, 'LineString');
});
// ── Port codes (core, without the dataset) ──────────────────────────────────

test('a UN/LOCODE string throws UnknownPortError when no dataset is registered', (t) => {
  // The core does not bundle the port dataset; without importing
  // 'searoute-ts/ports', a string origin/destination cannot be resolved.
  const err = t.throws(() => seaRoute('CNSHA', 'NLRTM'), { instanceOf: UnknownPortError });
  t.is(err?.code, 'CNSHA');
  t.regex(err!.message, /searoute-ts\/ports/);
});

// ── Custom network ──────────────────────────────────────────────────────────

test('custom network option is honoured', (t) => {
  // Tiny network: one LineString across the Atlantic
  const customNet = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [-74, 40],
            [-30, 45],
            [0, 51],
          ],
        },
      },
    ],
  };
  const r = seaRoute([-74, 40], [0, 51], { units: 'kilometers', network: customNet });
  t.is(r.geometry.coordinates.length, 3);
  t.true(r.properties.length > 5000 && r.properties.length < 8000);
});

// ── loadNetwork (optional remote/CDN loader) ────────────────────────────────

const ATLANTIC_NET = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-74, 40],
          [-30, 45],
          [0, 51],
        ],
      },
    },
  ],
};

function fakeResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

test('loadNetwork fetches a network and returns it usable by seaRoute', async (t) => {
  let requested = '';
  const stub = (async (url: string) => {
    requested = String(url);
    return fakeResponse(ATLANTIC_NET);
  }) as unknown as typeof fetch;

  const network = await loadNetwork('https://cdn.example.com/marnet.json', { fetch: stub });

  t.is(requested, 'https://cdn.example.com/marnet.json');
  t.is(network.type, 'FeatureCollection');
  const route = seaRoute([-74, 40], [0, 51], { units: 'kilometers', network });
  t.is(route.geometry.coordinates.length, 3);
});

test('loadNetwork throws a clear error on a non-OK response', async (t) => {
  const stub = (async () =>
    fakeResponse({}, { ok: false, status: 404 })) as unknown as typeof fetch;
  await t.throwsAsync(loadNetwork('https://cdn.example.com/missing.json', { fetch: stub }), {
    message: /404/,
  });
});

test('loadNetwork rejects payloads that are not a GeoJSON FeatureCollection', async (t) => {
  const stub = (async () => fakeResponse({ type: 'Nope' })) as unknown as typeof fetch;
  await t.throwsAsync(loadNetwork('https://cdn.example.com/bad.json', { fetch: stub }), {
    message: /FeatureCollection/,
  });
});
