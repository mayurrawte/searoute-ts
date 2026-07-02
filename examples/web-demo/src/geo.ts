export type LngLat = [number, number];

/**
 * Unwrap a [-180, 180]-wrapped line so it renders continuously across the
 * antimeridian: each longitude is shifted by a multiple of 360° until the
 * step from the previous point is the short way round. MapLibre handles
 * out-of-range longitudes natively (issue #5).
 */
export function unwrapLine(coords: LngLat[]): LngLat[] {
  if (coords.length === 0) return [];
  const out: LngLat[] = [[coords[0][0], coords[0][1]]];
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
    out.push([lon, coords[i][1]]);
  }
  return out;
}
