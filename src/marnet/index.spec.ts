import test from 'ava';

import { DEFAULT_MARNET as MARNET_20KM } from './marnet-20km';
import { DEFAULT_MARNET as MARNET_50KM } from './marnet-50km';
import { clearFinderCache, DEFAULT_MARNET, seaRoute } from '../index';

test.beforeEach(() => clearFinderCache());

const SHANGHAI: [number, number] = [121.5, 31.0];
const ROTTERDAM: [number, number] = [4.4, 51.9];

test('marnet-20km exposes a finer FeatureCollection of LineStrings', (t) => {
  t.is(MARNET_20KM.type, 'FeatureCollection');
  t.true(MARNET_20KM.features.length > 25000, `got ${MARNET_20KM.features.length} features`);
  t.true(MARNET_20KM.features.every((f) => f.geometry.type === 'LineString'));
  // Finer than the bundled 100 km default.
  t.true(MARNET_20KM.features.length > DEFAULT_MARNET.features.length);
});

test('marnet-50km exposes a network between the default and 20 km resolution', (t) => {
  t.is(MARNET_50KM.type, 'FeatureCollection');
  t.true(MARNET_50KM.features.length > 12000, `got ${MARNET_50KM.features.length} features`);
  t.true(MARNET_50KM.features.every((f) => f.geometry.type === 'LineString'));
  t.true(MARNET_50KM.features.length > DEFAULT_MARNET.features.length);
  t.true(MARNET_50KM.features.length < MARNET_20KM.features.length);
});

test('resolution variants keep the native passage labels', (t) => {
  const labels = (net: typeof MARNET_20KM) =>
    new Set(net.features.map((f) => f.properties?.pass).filter(Boolean));
  t.true(labels(MARNET_20KM).has('suez'));
  t.true(labels(MARNET_20KM).has('panama'));
  t.true(labels(MARNET_50KM).has('suez'));
});

test('seaRoute accepts a resolution variant via the network option', (t) => {
  const r = seaRoute(SHANGHAI, ROTTERDAM, { network: MARNET_20KM, units: 'kilometers' });
  t.is(r.geometry.type, 'LineString');
  // Shanghai → Rotterdam via Suez sits in the same ~19,000–21,000 km band as the
  // default network; the finer graph should not change the corridor materially.
  t.true(r.properties.length > 18000 && r.properties.length < 22000, `${r.properties.length} km`);
});

test('the 20 km network yields a higher-fidelity (more detailed) path than the default', (t) => {
  const fine = seaRoute(SHANGHAI, ROTTERDAM, { network: MARNET_20KM, units: 'kilometers' });
  const coarse = seaRoute(SHANGHAI, ROTTERDAM, { units: 'kilometers' });
  t.true(
    fine.geometry.coordinates.length > coarse.geometry.coordinates.length,
    `fine ${fine.geometry.coordinates.length} vs coarse ${coarse.geometry.coordinates.length}`,
  );
});
