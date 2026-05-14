import distance from '@turf/distance';
import { point as turfPoint } from '@turf/helpers';
import { coordEach, featureEach } from '@turf/meta';
import pointToLineDistance from '@turf/point-to-line-distance';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

/** Thrown when an input point cannot be projected onto the network. */
export class SnapFailedError extends Error {
  readonly side: 'origin' | 'destination';
  readonly distanceKm: number;
  constructor(side: 'origin' | 'destination', distanceKm: number) {
    super(
      `Failed to snap ${side} to the maritime network` +
        (Number.isFinite(distanceKm) ? ` (nearest line is ${distanceKm.toFixed(1)} km away)` : ''),
    );
    this.name = 'SnapFailedError';
    this.side = side;
    this.distanceKm = distanceKm;
  }
}

export type SnapResult = {
  snapped: Feature<Point>;
  /** Great-circle distance from the input to the snapped network vertex, km. */
  distanceKm: number;
};

/**
 * Snap a point onto the nearest vertex of the network.
 *
 * The function works in two passes — first find the nearest LineString (cheap
 * point-to-segment distance), then find the nearest vertex on that line. This
 * is the same approach used by the original Eurostat searoute Java library.
 *
 * If `maxKm` is provided and the input is further than `maxKm` from any line,
 * `SnapFailedError` is thrown rather than silently snapping to a faraway
 * coast — useful to catch landlocked or typo'd inputs early.
 */
export function snapToNetwork(
  pt: Feature<Point>,
  network: FeatureCollection<LineString>,
  side: 'origin' | 'destination',
  maxKm?: number,
): SnapResult {
  let nearestLineIndex = -1;
  let nearestLineDistance = Infinity;

  featureEach(network, (feature, idx) => {
    const d = pointToLineDistance(pt, feature as Feature<LineString>, { units: 'kilometers' });
    if (d < nearestLineDistance) {
      nearestLineDistance = d;
      nearestLineIndex = idx;
    }
  });

  if (nearestLineIndex < 0) throw new SnapFailedError(side, Infinity);
  if (maxKm !== undefined && nearestLineDistance > maxKm) {
    throw new SnapFailedError(side, nearestLineDistance);
  }

  let nearestCoord: Feature<Point> | undefined;
  let nearestVertexDist = Infinity;
  coordEach(network.features[nearestLineIndex], (coord) => {
    const candidate = turfPoint(coord);
    const d = distance(pt, candidate, { units: 'kilometers' });
    if (d < nearestVertexDist) {
      nearestVertexDist = d;
      nearestCoord = candidate;
    }
  });

  if (!nearestCoord) throw new SnapFailedError(side, nearestLineDistance);
  return { snapped: nearestCoord, distanceKm: nearestVertexDist };
}
