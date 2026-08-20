import type { Position } from 'geojson';

import { unwrapCoords } from './antimeridian.js';
import { greatCircleKm } from './metrics.js';

/** Axis-aligned bbox: [minLon, minLat, maxLon, maxLat]. */
export type EcaBbox = [number, number, number, number];

/**
 * An emission-control area, approximated by one or more axis-aligned bounding
 * boxes. Real ECA/SECA boundaries are complex polygons (the North American ECA
 * follows a 200 nm offset from the baseline); these bbox envelopes are a rough
 * approximation suitable for the estimate that `properties.ecaKm` reports, and
 * can be replaced with authoritative polygons via {@link registerEcaZones}.
 */
export type EcaZone = {
  /** Human-readable zone name, e.g. `'North Sea SECA'`. */
  name: string;
  /** Bounding boxes whose union approximates the zone's sea extent. */
  bboxes: EcaBbox[];
};

let activeZones: readonly EcaZone[] = [];

/**
 * Register the emission-control-area zones used to compute `properties.ecaKm`.
 * Called as a side effect of importing `searoute-ts/eca`; can also be used to
 * plug in a custom (e.g. higher-fidelity, full-polygon) zone set. Pass an empty
 * array to clear.
 */
export function registerEcaZones(zones: readonly EcaZone[]): void {
  activeZones = zones;
}

/** The currently registered ECA zones (empty until `searoute-ts/eca` is imported). */
export function getEcaZones(): readonly EcaZone[] {
  return activeZones;
}

/** True when at least one ECA zone has been registered. */
export function hasEcaZones(): boolean {
  return activeZones.length > 0;
}

function pointInBbox(lon: number, lat: number, bb: EcaBbox): boolean {
  return lon >= bb[0] && lon <= bb[2] && lat >= bb[1] && lat <= bb[3];
}

/** Bring a (possibly unwrapped) longitude back into [-180, 180). */
function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Kilometres of the path that fall inside any registered ECA zone.
 *
 * Each segment is subdivided into ~5 km steps; a step counts as "inside" when
 * its midpoint falls in any zone bbox, and its geodesic length is accumulated.
 * This mirrors the bbox-based passage detection and is intentionally a rough
 * figure (see {@link EcaZone}). Returns 0 when no zones are registered.
 *
 * Coordinates are unwrapped first so that segments crossing the ±180°
 * antimeridian interpolate the short way round; each midpoint is wrapped back
 * into ±180° before the zone test.
 */
export function ecaDistanceKm(coords: Position[]): number {
  const zones = activeZones;
  if (zones.length === 0 || coords.length < 2) return 0;
  const boxes: EcaBbox[] = zones.flatMap((z) => z.bboxes);

  const u = unwrapCoords(coords);
  const STEP_KM = 5;
  let inside = 0;
  for (let i = 0; i < u.length - 1; i++) {
    const a = u[i];
    const b = u[i + 1];
    const segKm = greatCircleKm(a, b);
    if (segKm === 0) continue;
    const steps = Math.max(1, Math.ceil(segKm / STEP_KM));
    const stepKm = segKm / steps;
    for (let s = 0; s < steps; s++) {
      const tMid = (s + 0.5) / steps;
      const lon = wrapLon(a[0] + (b[0] - a[0]) * tMid);
      const lat = a[1] + (b[1] - a[1]) * tMid;
      if (boxes.some((bb) => pointInBbox(lon, lat, bb))) inside += stepKm;
    }
  }
  return inside;
}
