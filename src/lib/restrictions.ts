import type { Position } from 'geojson';

/**
 * Named maritime passages that can be forbidden via `restrictions`.
 *
 * The first 12 names correspond exactly to the `pass` attribute used in the
 * Eurostat searoute v3.5 marnet — for those, restriction is exact (the
 * network feature itself carries the label). The remaining four (`sunda`,
 * `bosporus`, `ormuz`, `cape_horn`) are not labelled in the data, so we fall
 * back to bounding-box detection along edges.
 *
 * Aliases: `babalmandab` is accepted as a synonym for `babelmandeb` (Eurostat
 * spelling) to preserve back-compat with the genthalili/searoute-py naming.
 */
export type Passage =
  | 'suez'
  | 'panama'
  | 'gibraltar'
  | 'babelmandeb'
  | 'babalmandab'
  | 'bosporus'
  | 'ormuz'
  | 'malacca'
  | 'sunda'
  | 'dover'
  | 'kiel'
  | 'corinth'
  | 'bering'
  | 'magellan'
  | 'cape_horn'
  | 'northwest'
  | 'northeast';

/** Passage names that appear directly as `properties.pass` on marnet features. */
const NATIVE_PASS_LABELS = new Set<string>([
  'suez',
  'panama',
  'gibraltar',
  'babelmandeb',
  'malacca',
  'dover',
  'kiel',
  'corinth',
  'bering',
  'magellan',
  'northwest',
  'northeast',
]);

/** Translate user-facing names to the canonical Eurostat label set. */
const PASSAGE_ALIASES: Record<string, string> = {
  babalmandab: 'babelmandeb',
};

export function canonicalizePassage(p: Passage): string {
  return PASSAGE_ALIASES[p] ?? p;
}

/** Axis-aligned bbox: [minLon, minLat, maxLon, maxLat]. */
export type Bbox = [number, number, number, number];

/**
 * Bounding boxes for passages that aren't natively labelled in the Eurostat
 * marnet. Used only as a fallback when the data doesn't carry a `pass` tag.
 *
 * Native labelled passages also have bboxes here so `passagesAlong()` can
 * report them when callers ask for `returnPassages` without restrictions.
 */
export const PASSAGE_BBOXES: Record<Passage, Bbox[]> = {
  suez: [[32.0, 29.5, 32.9, 31.5]],
  panama: [[-80.2, 8.85, -79.3, 9.45]],
  gibraltar: [[-5.95, 35.7, -5.2, 36.2]],
  babelmandeb: [[42.9, 12.3, 43.6, 13.0]],
  babalmandab: [[42.9, 12.3, 43.6, 13.0]],
  bosporus: [[28.9, 40.95, 29.25, 41.35]],
  ormuz: [[55.9, 26.0, 57.0, 27.2]],
  malacca: [[99.0, 1.0, 104.0, 6.0]],
  sunda: [[105.4, -6.7, 106.3, -5.7]],
  dover: [[1.0, 50.5, 2.0, 51.3]],
  kiel: [[9.0, 53.85, 10.05, 54.4]],
  corinth: [[22.8, 37.9, 23.1, 38.0]],
  bering: [[-171.0, 64.5, -167.0, 66.5]],
  magellan: [[-75.5, -54.5, -67.5, -52.0]],
  cape_horn: [[-68.0, -57.5, -65.0, -55.5]],
  northwest: [[-130.0, 66.0, -60.0, 80.0]],
  northeast: [[30.0, 68.0, 180.0, 82.0]],
};

/**
 * Exact segment-vs-bbox test (Liang–Barsky clip). A narrow strait bbox can
 * sit entirely between two vertices of a long network edge, so sampling
 * points along the edge is not enough — the Bosporus slips through a
 * 5-sample grid, for instance. Degenerates to point-in-bbox when a === b.
 */
function segmentIntersectsBbox(a: Position, b: Position, bb: Bbox): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - bb[0], bb[2] - a[0], a[1] - bb[1], bb[3] - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

/** True when the edge a→b passes through any of the supplied bboxes. */
export function edgeIntersectsAny(a: Position, b: Position, bboxes: Bbox[]): boolean {
  return bboxes.some((bb) => segmentIntersectsBbox(a, b, bb));
}

/**
 * Build a fast lookup of which named passages we should detect via the native
 * `pass` attribute versus bbox fallback, given a set of user restrictions.
 */
export function partitionRestrictions(restrictions: readonly Passage[]): {
  nativeLabels: Set<string>;
  bboxBlocks: Bbox[];
} {
  const nativeLabels = new Set<string>();
  const bboxBlocks: Bbox[] = [];
  for (const r of restrictions) {
    const canonical = canonicalizePassage(r);
    if (NATIVE_PASS_LABELS.has(canonical)) {
      nativeLabels.add(canonical);
    } else {
      bboxBlocks.push(...PASSAGE_BBOXES[r]);
    }
  }
  return { nativeLabels, bboxBlocks };
}

/**
 * Returns the passages whose bboxes contain at least one of the route coords.
 * Used by `returnPassages` to label which named passages a finished route
 * traversed.
 */
export function passagesAlong(coords: Position[]): Passage[] {
  const hit = new Set<Passage>();
  // Names to report. We keep both `babelmandeb` and `babalmandab` in the
  // Passage union for input back-compat, but only report `babelmandeb` here.
  const REPORT_NAMES: Passage[] = [
    'suez',
    'panama',
    'gibraltar',
    'babelmandeb',
    'bosporus',
    'ormuz',
    'malacca',
    'sunda',
    'dover',
    'kiel',
    'corinth',
    'bering',
    'magellan',
    'cape_horn',
    'northwest',
    'northeast',
  ];
  for (let i = 0; i < coords.length; i++) {
    // Test the segment to the next point (degenerate at the last coord) so
    // straits crossed mid-edge are still reported.
    const a = coords[i];
    const b = coords[i + 1] ?? a;
    for (const name of REPORT_NAMES) {
      if (hit.has(name)) continue;
      if (PASSAGE_BBOXES[name].some((bb) => segmentIntersectsBbox(a, b, bb))) hit.add(name);
    }
  }
  return Array.from(hit);
}
