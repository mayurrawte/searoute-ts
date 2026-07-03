import type { Position } from 'geojson';

/**
 * How to represent a route that crosses the ±180° antimeridian.
 *
 * - `'unwrap'` — keep a single continuous LineString, shifting longitudes by
 *   multiples of 360° so consecutive points never jump the dateline. Some
 *   longitudes may fall outside ±180°. This is what most web map renderers
 *   (MapLibre, Leaflet, Deck.gl) want to draw the line the short way round.
 * - `'split'` — cut the route into a `MultiLineString` at ±180°, so every
 *   coordinate stays within ±180°. More correct for GeoJSON tooling that
 *   follows RFC 7946.
 */
export type Antimeridian = 'unwrap' | 'split';

/** Copy a position, replacing its longitude (preserving lat and any Z/extra dims). */
function withLon(p: Position, lon: number): Position {
  const out = p.slice();
  out[0] = lon;
  return out;
}

/**
 * Shift each longitude by a multiple of 360° so that the step from the previous
 * point is always the short way round, producing a continuous line across the
 * antimeridian. Longitudes may exceed ±180°. Does not mutate the input, and
 * returns lines that never cross the dateline unchanged.
 */
export function unwrapCoords(coords: Position[]): Position[] {
  if (coords.length === 0) return [];
  const out: Position[] = [coords[0].slice()];
  let offset = 0;
  for (let i = 1; i < coords.length; i++) {
    let lon = coords[i][0] + offset;
    const prev = out[i - 1][0];
    while (lon - prev > 180) {
      offset -= 360;
      lon -= 360;
    }
    while (lon - prev <= -180) {
      offset += 360;
      lon += 360;
    }
    out.push(withLon(coords[i], lon));
  }
  return out;
}

/** Which 360°-wide panel a longitude falls in (panel boundaries at 180 + 360k). */
function panelOf(lon: number): number {
  return Math.floor((lon + 180) / 360);
}

/** Append a point unless it exactly repeats the segment's current last point. */
function pushPoint(segment: Position[], p: Position): void {
  const last = segment[segment.length - 1];
  if (last && last[0] === p[0] && last[1] === p[1]) return;
  segment.push(p);
}

/**
 * Split a route into segments that each stay within ±180°, cutting at every
 * antimeridian crossing and inserting the interpolated dateline point at both
 * ends of the cut. Always returns at least one segment; a route that never
 * crosses the dateline comes back as a single (longitude-wrapped) segment.
 *
 * Works on the unwrapped (continuous) coordinates, then brings each resulting
 * sub-line back into ±180° by its panel offset. Vertices that sit exactly on
 * the dateline (the bundled network normalizes ±180° vertices) are handled as
 * crossings rather than being dropped.
 */
export function splitAtAntimeridian(coords: Position[]): Position[][] {
  if (coords.length === 0) return [];

  const u = unwrapCoords(coords);
  const wrapInto = (p: Position, panel: number): Position => withLon(p, p[0] - 360 * panel);

  const segments: Position[][] = [];
  let panel = panelOf(u[0][0]);
  let current: Position[] = [wrapInto(u[0], panel)];

  for (let i = 1; i < u.length; i++) {
    const prev = u[i - 1];
    const cur = u[i];
    const curPanel = panelOf(cur[0]);

    if (curPanel === panel) {
      pushPoint(current, wrapInto(cur, panel));
      continue;
    }

    // Unwrapped steps are < 360°, so panels differ by exactly one: one crossing.
    const dir = curPanel > panel ? 1 : -1;
    const boundary = 180 + 360 * (dir > 0 ? panel : panel - 1);
    const t = (boundary - prev[0]) / (cur[0] - prev[0]);
    const lat = prev[1] + t * (cur[1] - prev[1]);

    pushPoint(current, [boundary - 360 * panel, lat]); // +180 east, -180 west
    segments.push(current);

    panel = curPanel;
    current = [[boundary - 360 * panel, lat]]; // -180 east, +180 west
    pushPoint(current, wrapInto(cur, panel));
  }

  segments.push(current);
  return segments;
}
