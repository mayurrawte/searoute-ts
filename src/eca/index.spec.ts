import test from 'ava';
import type { Feature, Point } from 'geojson';

import { ecaDistanceKm, getEcaZones, hasEcaZones, registerEcaZones, seaRoute } from '../index';
// Importing the subpath registers the default ECA zones as a side effect.
import { ECA_ZONES } from './index';

function pt(lon: number, lat: number): Feature<Point> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [lon, lat] },
  };
}

const ROTTERDAM = pt(4.4, 51.9);
const LONDON = pt(-0.13, 51.5);
const SINGAPORE = pt(103.8, 1.3);
const MUMBAI = pt(72.9, 19.0);

test('importing searoute-ts/eca registers the default ECA zones', (t) => {
  t.true(hasEcaZones());
  t.is(ECA_ZONES.length, 5);
  t.is(getEcaZones().length, 5);
});

test('a North Sea route reports most of its length inside an ECA', (t) => {
  const r = seaRoute(ROTTERDAM, LONDON, { units: 'kilometers', emissions: true });
  t.true((r.properties.ecaKm ?? 0) > 0, 'should have ECA distance');
  t.true((r.properties.ecaKm ?? 0) <= r.properties.length + 1e-6, 'ecaKm cannot exceed length');
  t.true(
    (r.properties.ecaFraction ?? 0) > 0.5,
    `southern North Sea should be mostly in-zone, got ${r.properties.ecaFraction}`,
  );
});

test('an open-ocean route outside any ECA reports ~0 ECA distance', (t) => {
  const r = seaRoute(SINGAPORE, MUMBAI, { units: 'kilometers', emissions: true });
  t.true(
    (r.properties.ecaKm ?? 0) < r.properties.length * 0.05,
    `Indian Ocean route should be out of zone, got ecaKm ${r.properties.ecaKm} of ${r.properties.length}`,
  );
});

test('ecaKm and co2eTonnes can be reported together', (t) => {
  const r = seaRoute(ROTTERDAM, LONDON, {
    units: 'kilometers',
    emissions: true,
    vesselClass: 'feeder',
  });
  t.true((r.properties.ecaKm ?? 0) > 0);
  t.true((r.properties.co2eTonnes ?? 0) > 0);
});

test('ecaDistanceKm measures a line inside the Mediterranean SECA', (t) => {
  // ~2° of longitude at 42°N off the French/Spanish Med coast, fully in-zone.
  const km = ecaDistanceKm([
    [4.0, 42.0],
    [6.0, 42.0],
  ]);
  t.true(km > 100 && km < 220, `expected ~165 km inside the Med, got ${km}`);
});

test('ecaDistanceKm reports 0 for a mid-Pacific segment crossing the antimeridian', (t) => {
  // 170°E → 170°W at 45°N: the short way crosses the dateline, thousands of km
  // from any ECA. Linear interpolation in wrapped lon/lat would sweep the
  // midpoints the long way round through 0° — straight through the
  // Mediterranean and North Sea boxes.
  const km = ecaDistanceKm([
    [170.0, 45.0],
    [-170.0, 45.0],
  ]);
  t.is(km, 0, `dateline-crossing open-ocean segment must be out of zone, got ${km}`);
});

test('a trans-Pacific route crossing the dateline reports 0 ECA distance', (t) => {
  // Yokohama → Honolulu: crosses the antimeridian, never nears an ECA
  // (Hawaii is outside the North American ECA).
  const r = seaRoute(pt(139.65, 35.44), pt(-157.86, 21.3), {
    units: 'kilometers',
    emissions: true,
  });
  t.is(
    r.properties.ecaKm ?? 0,
    0,
    `mid-Pacific route must have no ECA distance, got ${r.properties.ecaKm}`,
  );
});

test.serial('registerEcaZones swaps in custom zones (restored synchronously)', (t) => {
  const original = getEcaZones();
  registerEcaZones([{ name: 'test-box', bboxes: [[0, 0, 10, 10]] }]);
  const km = ecaDistanceKm([
    [1, 5],
    [9, 5],
  ]);
  t.true(km > 800, `custom zone should capture the ~8° line, got ${km}`);
  // Restore before the test returns (no awaits ⇒ atomic w.r.t. other tests).
  registerEcaZones([...original]);
  t.is(getEcaZones().length, original.length);
});
