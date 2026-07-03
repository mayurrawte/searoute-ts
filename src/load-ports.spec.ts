import test from 'ava';

import { loadPorts, seaRoute, UnknownPortError } from './index';

// A tiny UN/LOCODE dataset whose coordinates sit near the bundled network, so a
// resolved route actually computes. Kept in its own spec file because loadPorts
// registers a process-global resolver.
const PORTS = {
  XXNYC: { name: 'New York', country: 'XX', coordinates: [-74.04, 40.69] as [number, number] },
  XXLDN: { name: 'London', country: 'XX', coordinates: [-0.13, 51.5] as [number, number] },
};

function fakeResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

test.serial('loadPorts fetches, registers, and enables seaRoute by UN/LOCODE', async (t) => {
  let requested = '';
  const stub = (async (url: string) => {
    requested = String(url);
    return fakeResponse(PORTS);
  }) as unknown as typeof fetch;

  const ports = await loadPorts('https://cdn.example.com/ports.json', { fetch: stub });

  t.is(requested, 'https://cdn.example.com/ports.json');
  t.is(Object.keys(ports).length, 2);
  // The resolver is now registered: a code string routes end-to-end.
  const route = seaRoute('XXNYC', 'xxldn', { units: 'kilometers' }); // case-insensitive
  t.is(route.geometry.type, 'LineString');
  t.true(route.properties.length > 0);
});

test.serial('loadPorts throws a clear error on a non-OK response', async (t) => {
  const stub = (async () =>
    fakeResponse({}, { ok: false, status: 404 })) as unknown as typeof fetch;
  await t.throwsAsync(loadPorts('https://cdn.example.com/missing.json', { fetch: stub }), {
    message: /404/,
  });
});

test.serial('loadPorts rejects a payload that is not a UN/LOCODE object', async (t) => {
  const stub = (async () => fakeResponse(['not', 'an', 'object'])) as unknown as typeof fetch;
  await t.throwsAsync(loadPorts('https://cdn.example.com/bad.json', { fetch: stub }), {
    message: /UN\/LOCODE|object/,
  });
  // Sanity: UnknownPortError is still the error type for genuinely missing codes.
  t.is(new UnknownPortError('ZZZZZ', true).name, 'UnknownPortError');
});
