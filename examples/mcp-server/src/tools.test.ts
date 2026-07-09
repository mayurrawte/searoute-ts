import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  runSeaRoute,
  runSeaRouteAlternatives,
  seaRouteAlternativesInputSchema,
  seaRouteInputSchema,
} from './tools.js';

const seaRouteArgs = (input: Record<string, unknown>) =>
  z.object(seaRouteInputSchema).parse(input);
const altArgs = (input: Record<string, unknown>) =>
  z.object(seaRouteAlternativesInputSchema).parse(input);

describe('sea_route', () => {
  it('routes between UN/LOCODE port codes and reports passages + geometry', () => {
    const res = runSeaRoute(
      seaRouteArgs({ origin: 'CNSHA', destination: 'NLRTM', units: 'kilometers' }),
    );
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as {
      distance: number;
      units: string;
      passages: string[];
      geojson: { geometry: { type: string } };
    };
    // Shanghai → Rotterdam via Suez ≈ 19,000–21,000 km.
    expect(sc.units).toBe('kilometers');
    expect(sc.distance).toBeGreaterThan(19000);
    expect(sc.distance).toBeLessThan(21000);
    expect(sc.passages).toContain('suez');
    expect(sc.geojson.geometry.type).toBe('LineString');
    expect(res.content[0].text).toContain('Sea route');
  });

  it('accepts [lon, lat] coordinates', () => {
    const res = runSeaRoute(
      seaRouteArgs({ origin: [121.5, 31.0], destination: [4.4, 51.9], units: 'kilometers' }),
    );
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as { distance: number };
    expect(sc.distance).toBeGreaterThan(18000);
    expect(sc.distance).toBeLessThan(22000);
  });

  it('honours restrictions — avoiding Suez forces a longer route without Suez', () => {
    const viaSuez = runSeaRoute(
      seaRouteArgs({ origin: 'CNSHA', destination: 'NLRTM', units: 'kilometers' }),
    ).structuredContent as { distance: number };
    const capeRes = runSeaRoute(
      seaRouteArgs({
        origin: 'CNSHA',
        destination: 'NLRTM',
        units: 'kilometers',
        restrictions: ['suez', 'babelmandeb'],
      }),
    );
    const cape = capeRes.structuredContent as { distance: number; passages: string[] };
    expect(cape.passages).not.toContain('suez');
    expect(cape.distance).toBeGreaterThan(viaSuez.distance);
  });

  it('fills durationHours when speedKnots is provided', () => {
    const res = runSeaRoute(
      seaRouteArgs({ origin: 'CNSHA', destination: 'NLRTM', speedKnots: 14 }),
    );
    const sc = res.structuredContent as { durationHours?: number };
    expect(sc.durationHours).toBeGreaterThan(0);
  });

  it('omits geometry when includeGeometry is false', () => {
    const res = runSeaRoute(
      seaRouteArgs({ origin: 'CNSHA', destination: 'NLRTM', includeGeometry: false }),
    );
    expect((res.structuredContent as Record<string, unknown>).geojson).toBeUndefined();
  });

  it('returns an error result for an unknown port code', () => {
    const res = runSeaRoute(seaRouteArgs({ origin: 'ZZZZZ', destination: 'NLRTM' }));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('UnknownPortError');
  });
});

describe('sea_route_alternatives', () => {
  it('returns up to k distinct alternatives sorted by distance', () => {
    const res = runSeaRouteAlternatives(
      altArgs({ origin: 'CNSHA', destination: 'NLRTM', k: 3, units: 'kilometers' }),
    );
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as {
      count: number;
      alternatives: { variant: string; distance: number }[];
    };
    expect(sc.count).toBeGreaterThanOrEqual(1);
    expect(sc.count).toBeLessThanOrEqual(3);
    // Sorted ascending by distance.
    const distances = sc.alternatives.map((a) => a.distance);
    expect([...distances].sort((x, y) => x - y)).toEqual(distances);
    // Distinct variants.
    const variants = sc.alternatives.map((a) => a.variant);
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('defaults k to 3 and geometry off', () => {
    const args = altArgs({ origin: 'CNSHA', destination: 'NLRTM' });
    expect(args.k).toBe(3);
    expect(args.includeGeometry).toBe(false);
    const res = runSeaRouteAlternatives(args);
    const sc = res.structuredContent as { alternatives: Record<string, unknown>[] };
    expect(sc.alternatives[0].geojson).toBeUndefined();
  });
});
