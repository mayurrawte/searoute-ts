import test from 'ava';

// Importing the subpath registers the UN/LOCODE resolver into the core as a
// side effect, enabling seaRoute('CNSHA', 'NLRTM').
import { lookupPort, PORT_COUNT, PORTS, resolvePort, UnknownPortError } from './index';
import { clearFinderCache, seaRoute } from '../index';

test.beforeEach(() => clearFinderCache());

test('bundles a substantial seaport dataset', (t) => {
  t.true(PORT_COUNT > 1000, `expected >1000 codes, got ${PORT_COUNT}`);
  t.is(PORT_COUNT, Object.keys(PORTS).length);
});

test('lookupPort resolves a major port with plausible coordinates', (t) => {
  const shanghai = lookupPort('CNSHA');
  t.truthy(shanghai);
  t.is(shanghai?.code, 'CNSHA');
  t.is(shanghai?.name, 'Shanghai');
  const [lon, lat] = shanghai!.coordinates;
  t.true(lon > 120 && lon < 123, `lon ${lon}`);
  t.true(lat > 30 && lat < 32, `lat ${lat}`);
});

test('lookupPort is case-insensitive and ignores whitespace', (t) => {
  t.deepEqual(lookupPort(' cnsha '), lookupPort('CNSHA'));
  t.deepEqual(lookupPort('nl rtm'), lookupPort('NLRTM'));
});

test('UN/LOCODE aliases resolve to the same port', (t) => {
  // Shanghai carries both CNSHA and CNSGH in the source dataset.
  t.deepEqual(lookupPort('CNSGH')?.coordinates, lookupPort('CNSHA')?.coordinates);
});

test('lookupPort returns undefined for an unknown code', (t) => {
  t.is(lookupPort('ZZZZZ'), undefined);
});

test('resolvePort returns [lon, lat] and throws UnknownPortError for unknown codes', (t) => {
  const rtm = resolvePort('NLRTM');
  t.is(rtm.length, 2);
  t.true(rtm[0] > 3 && rtm[0] < 6);
  const err = t.throws(() => resolvePort('ZZZZZ'), { instanceOf: UnknownPortError });
  t.is(err?.code, 'ZZZZZ');
});

test("seaRoute accepts UN/LOCODE strings once 'searoute-ts/ports' is imported", (t) => {
  const r = seaRoute('CNSHA', 'NLRTM', { units: 'kilometers' });
  // Shanghai → Rotterdam via Suez ≈ 19 000–21 000 km (matches the coordinate test).
  t.true(r.properties.length > 19000 && r.properties.length < 21000, `${r.properties.length} km`);
});

test('seaRoute accepts a mix of port code and coordinates', (t) => {
  const byCode = seaRoute('CNSHA', 'NLRTM', { units: 'kilometers' });
  const mixed = seaRoute('CNSHA', [4.5, 51.92], { units: 'kilometers' });
  // NLRTM resolves to ~[4.5, 51.92], so the two routes should be identical.
  t.is(Math.round(byCode.properties.length), Math.round(mixed.properties.length));
});

test('an unknown port code throws UnknownPortError through seaRoute', (t) => {
  const err = t.throws(() => seaRoute('ZZZZZ', 'NLRTM'), { instanceOf: UnknownPortError });
  t.is(err?.code, 'ZZZZZ');
});
