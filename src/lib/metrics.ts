import distance from '@turf/distance';
import { point as turfPoint } from '@turf/helpers';
import type { Position } from 'geojson';

/** [minLon, minLat, maxLon, maxLat] */
export type Bbox4 = [number, number, number, number];

export function bboxOf(coords: readonly Position[]): Bbox4 {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Great-circle (haversine) distance in kilometres between two coordinates.
 * Handles antimeridian crossing correctly.
 */
export function greatCircleKm(a: Position, b: Position): number {
  return distance(turfPoint(a), turfPoint(b), { units: 'kilometers' });
}
