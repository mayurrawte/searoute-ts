import {
  feature as turfFeature,
  lineString,
  multiLineString,
  point as turfPoint,
} from '@turf/helpers';
import type { Units } from '@turf/helpers';
import length from '@turf/length';
import type { Feature, LineString, MultiLineString, Point, Position } from 'geojson';

import { type Antimeridian, splitAtAntimeridian, unwrapCoords } from './lib/antimeridian.js';
import { passagesBlockedByDraft } from './lib/drafts.js';
import { buildFinder, DEFAULT_MARNET, type MarnetNetwork } from './lib/finder.js';
import { bboxOf, greatCircleKm } from './lib/metrics.js';
import { resolvePortCode } from './lib/ports.js';
import { type Passage, passagesAlong } from './lib/restrictions.js';
import { snapToNetwork } from './lib/snap.js';

export type { Antimeridian } from './lib/antimeridian.js';
export type { Passage } from './lib/restrictions.js';
export { PASSAGE_BBOXES } from './lib/restrictions.js';
export type { MarnetProperties } from './lib/marnet.js';
export type { MarnetNetwork } from './lib/finder.js';
export { DEFAULT_MARNET, clearFinderCache } from './lib/finder.js';
export { SnapFailedError } from './lib/snap.js';
export { CANAL_MAX_DRAFT_M } from './lib/drafts.js';
export {
  UnknownPortError,
  registerPortResolver,
  loadPorts,
  type PortResolver,
  type PortDataset,
  type LoadPortsOptions,
} from './lib/ports.js';

/**
 * Input accepted as origin/destination. A `string` is treated as a UN/LOCODE
 * port code (e.g. `'CNSHA'`); resolving codes requires importing the
 * `searoute-ts/ports` subpath (or registering a resolver via
 * `registerPortResolver`).
 */
export type PointInput = Position | Feature<Point> | Point | string;

export type SeaRouteOptions = {
  /** Output unit for `properties.length`. Defaults to nautical miles. */
  units?: Units;
  /**
   * Named passages the route is forbidden to traverse. Useful, for example,
   * to force Cape of Good Hope routing during a Red Sea/Suez disruption:
   *   `{ restrictions: ['suez', 'babelmandeb'] }`
   */
  restrictions?: Passage[];
  /**
   * When `false` (the default), the Northwest and Northeast Passages are
   * implicitly added to `restrictions`. They are mathematically the shortest
   * path for many Asia↔Europe and Asia↔East-Coast-Americas routes, but in
   * practice they are ice-blocked most of the year and not used by commercial
   * shipping. Set `true` to allow them.
   */
  allowArctic?: boolean;
  /**
   * Vessel speed in knots. When supplied, `properties.durationHours` is
   * filled in based on the route's geodesic length (excluding the land-side
   * legs, even if `appendOriginDestination` is true).
   */
  speedKnots?: number;
  /**
   * Vessel draft in metres. When supplied, canals with insufficient depth
   * are auto-added to `restrictions`. See `CANAL_MAX_DRAFT_M` for the limits
   * used (Panama 15.2 m, Suez 20.1 m, Kiel 7.0 m, Corinth 7.3 m).
   */
  vesselDraftMeters?: number;
  /**
   * If true, prepend `origin` and append `destination` to the LineString as
   * raw points, so callers can draw the full origin→port→port→destination
   * path. Note: this lengthens the line but does NOT contribute to
   * `properties.length` (which stays "in-water only").
   */
  appendOriginDestination?: boolean;
  /**
   * If true, fill `properties.passages` with the named passages the route
   * traverses (subset of `Passage`).
   */
  returnPassages?: boolean;
  /**
   * Reject inputs farther than this from the network (kilometres). Useful to
   * catch landlocked or typo'd coordinates rather than silently snapping
   * to a faraway coast. When unset, snapping accepts any distance.
   */
  maxSnapDistanceKm?: number;
  /**
   * Custom maritime network. Defaults to the bundled Eurostat
   * `marnet_plus_100km`. Pass a higher-resolution network (e.g. the 20 km
   * or 5 km Eurostat data, converted to GeoJSON) when more precision is
   * needed at the cost of bundle/computation.
   *
   * The network must be a `FeatureCollection<LineString>` with optional
   * `pass` string property on features for native passage restrictions.
   */
  network?: MarnetNetwork;
  /**
   * How to represent routes that cross the ±180° antimeridian (e.g. a
   * trans-Pacific Yokohama → LA route). By default (`undefined`) the geometry
   * is left wrapped to [-180, 180], which some map renderers draw as a straight
   * streak across the whole map.
   *
   * - `'unwrap'` — one continuous `LineString`; longitudes are shifted by
   *   multiples of 360° so the line never jumps the dateline (may exceed ±180°).
   * - `'split'` — a `MultiLineString` cut at ±180°, keeping every coordinate
   *   within ±180° (RFC 7946-friendly).
   *
   * Applies to `seaRoute` and `seaRouteMulti` output. `seaRouteAlternatives`
   * always returns wrapped `LineString`s.
   */
  antimeridian?: Antimeridian;
};

export type SeaRouteProperties = {
  length: number;
  units: Units;
  /** Estimated voyage duration in hours (when `speedKnots` is given). */
  durationHours?: number;
  /** Named passages the route traverses (when `returnPassages` is true). */
  passages?: Passage[];
  /** Bounding box of the in-water route: [minLon, minLat, maxLon, maxLat]. */
  bbox: [number, number, number, number];
  /** Haversine distance between input origin and destination, in `units`. */
  greatCircleLength: number;
  /**
   * route length / great-circle length — how much the network detours from
   * a straight geodesic. 1.0 means the route is exactly the great circle;
   * values > 1 are typical (land in the way, canals, traffic separation).
   */
  detourRatio: number;
  /** Snap distance from input origin to the network vertex used, in km. */
  originSnapKm: number;
  /** Snap distance from input destination to the network vertex used, in km. */
  destinationSnapKm: number;
};

export type SeaRouteFeature = Feature<LineString, SeaRouteProperties>;

/** A route returned with `antimeridian: 'split'` — split into a MultiLineString. */
export type SeaRouteMultiFeature = Feature<MultiLineString, SeaRouteProperties>;

/** Thrown when no path exists between the snapped origin and destination. */
export class NoRouteError extends Error {
  constructor(message = 'No sea route found between origin and destination') {
    super(message);
    this.name = 'NoRouteError';
  }
}

function toFeaturePoint(input: PointInput): Feature<Point> {
  if (typeof input === 'string') return turfPoint(resolvePortCode(input));
  if (Array.isArray(input)) return turfPoint(input);
  if ('geometry' in input) return input as Feature<Point>;
  return turfFeature(input as Point) as Feature<Point>;
}

function resolveRestrictions(options: SeaRouteOptions): Passage[] {
  const user = options.restrictions ?? [];
  const draft = options.vesselDraftMeters ? passagesBlockedByDraft(options.vesselDraftMeters) : [];
  const arctic: Passage[] = options.allowArctic ? [] : ['northwest', 'northeast'];
  return Array.from(new Set<Passage>([...user, ...draft, ...arctic]));
}

/**
 * Compute the shortest maritime route between two points.
 *
 * The points are snapped to the nearest vertex on the bundled Eurostat
 * marnet (or a custom `options.network`), then a shortest path is computed
 * with Dijkstra (via geojson-path-finder).
 *
 * Not intended for navigation. The result is a network path suitable for
 * visualisation and rough distance/duration estimates.
 *
 * @throws {SnapFailedError} when origin or destination cannot be snapped.
 * @throws {NoRouteError} when no path exists (e.g. an isolated subnetwork
 *   or all viable canals blocked).
 */
export function seaRoute(
  origin: PointInput,
  destination: PointInput,
  options: SeaRouteOptions & { antimeridian: 'split' },
): SeaRouteMultiFeature;
export function seaRoute(
  origin: PointInput,
  destination: PointInput,
  unitsOrOptions?: Units | SeaRouteOptions,
): SeaRouteFeature;
export function seaRoute(
  origin: PointInput,
  destination: PointInput,
  unitsOrOptions: Units | SeaRouteOptions = 'nauticalmiles',
): SeaRouteFeature | SeaRouteMultiFeature {
  const options: SeaRouteOptions =
    typeof unitsOrOptions === 'string' ? { units: unitsOrOptions } : unitsOrOptions;

  const units: Units = options.units ?? 'nauticalmiles';
  const network = options.network ?? DEFAULT_MARNET;
  const restrictions = resolveRestrictions(options);

  const originFeature = toFeaturePoint(origin);
  const destFeature = toFeaturePoint(destination);

  const oSnap = snapToNetwork(originFeature, network, 'origin', options.maxSnapDistanceKm);
  const dSnap = snapToNetwork(destFeature, network, 'destination', options.maxSnapDistanceKm);

  const finder = buildFinder(network, restrictions);
  const result = finder.findPath(oSnap.snapped, dSnap.snapped);
  if (!result) throw new NoRouteError();

  const inWaterCoords: Position[] = result.path.slice();
  if (inWaterCoords.length < 2) throw new NoRouteError();

  const coords: Position[] = inWaterCoords.slice();
  if (options.appendOriginDestination) {
    coords.unshift(originFeature.geometry.coordinates);
    coords.push(destFeature.geometry.coordinates);
  }

  const inWater = lineString(inWaterCoords);
  const lenInUnits = length(inWater, { units });
  const lenKm = length(inWater, { units: 'kilometers' });
  const gcKm = greatCircleKm(originFeature.geometry.coordinates, destFeature.geometry.coordinates);

  const properties: SeaRouteProperties = {
    length: lenInUnits,
    units,
    bbox: bboxOf(inWaterCoords),
    greatCircleLength: convertKm(gcKm, units),
    detourRatio: gcKm > 0 ? lenKm / gcKm : 1,
    originSnapKm: oSnap.distanceKm,
    destinationSnapKm: dSnap.distanceKm,
  };

  if (options.speedKnots && options.speedKnots > 0) {
    // 1 knot = 1.852 km/h
    properties.durationHours = lenKm / (options.speedKnots * 1.852);
  }

  if (options.returnPassages) {
    properties.passages = passagesAlong(result.path);
  }

  return buildRouteFeature(coords, properties, options.antimeridian);
}

/**
 * Compute a route visiting a sequence of waypoints in order. Returns one
 * LineString concatenated across all legs; `properties.length` is the total.
 *
 * Each leg respects the same options as `seaRoute`. The route uses the
 * snapped vertex of each waypoint, so the same waypoint coord is shared
 * between adjacent legs without duplication.
 */
export function seaRouteMulti(
  points: PointInput[],
  options: SeaRouteOptions & { antimeridian: 'split' },
): SeaRouteMultiFeature;
export function seaRouteMulti(points: PointInput[], options?: SeaRouteOptions): SeaRouteFeature;
export function seaRouteMulti(
  points: PointInput[],
  options: SeaRouteOptions = {},
): SeaRouteFeature | SeaRouteMultiFeature {
  if (points.length < 2) {
    throw new Error('seaRouteMulti requires at least two waypoints');
  }

  // Compute each leg as a plain wrapped LineString; the antimeridian option is
  // applied once to the concatenated route so the legs still join cleanly.
  const legOptions: SeaRouteOptions = { ...options, antimeridian: undefined };
  const legs: SeaRouteFeature[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    legs.push(seaRoute(points[i], points[i + 1], legOptions));
  }

  // Concatenate legs without duplicating shared join vertices.
  const coords: Position[] = legs[0].geometry.coordinates.slice();
  for (let i = 1; i < legs.length; i++) {
    const next = legs[i].geometry.coordinates;
    const tail = coords[coords.length - 1];
    const head = next[0];
    const same = tail && head && tail[0] === head[0] && tail[1] === head[1];
    coords.push(...(same ? next.slice(1) : next));
  }

  const units: Units = options.units ?? 'nauticalmiles';
  const totalUnits = legs.reduce((s, l) => s + l.properties.length, 0);

  // Great-circle for multi-leg = sum of consecutive GCs of inputs.
  const inputs = points.map(toFeaturePoint);
  let gcKm = 0;
  for (let i = 0; i < inputs.length - 1; i++) {
    gcKm += greatCircleKm(inputs[i].geometry.coordinates, inputs[i + 1].geometry.coordinates);
  }
  const totalKm = legs.reduce((s, l) => s + l.properties.length * unitToKm(l.properties.units), 0);

  const properties: SeaRouteProperties = {
    length: totalUnits,
    units,
    bbox: bboxOf(coords),
    greatCircleLength: convertKm(gcKm, units),
    detourRatio: gcKm > 0 ? totalKm / gcKm : 1,
    originSnapKm: legs[0].properties.originSnapKm,
    destinationSnapKm: legs[legs.length - 1].properties.destinationSnapKm,
  };

  if (options.speedKnots && options.speedKnots > 0) {
    properties.durationHours = totalKm / (options.speedKnots * 1.852);
  }

  if (options.returnPassages) {
    const set = new Set<Passage>();
    for (const l of legs) for (const p of l.properties.passages ?? []) set.add(p);
    properties.passages = Array.from(set);
  }

  return buildRouteFeature(coords, properties, options.antimeridian);
}

export type SeaRouteAlternative = SeaRouteFeature & {
  properties: SeaRouteProperties & {
    /** Stable label describing what's blocked relative to the unrestricted base. */
    variant: string;
  };
};

export type SeaRouteAlternativesOptions = SeaRouteOptions & {
  /** Maximum number of alternatives to return (including the baseline). */
  k?: number;
  /**
   * Reject candidate alternatives whose length is within this ratio of an
   * already-accepted route. e.g. `similarityThreshold: 0.02` rejects any
   * candidate within ±2% of an existing route's length. Default 0.02.
   */
  similarityThreshold?: number;
};

const ALTERNATIVE_VARIANTS: { label: string; extraRestrictions: Passage[] }[] = [
  { label: 'baseline', extraRestrictions: [] },
  { label: 'no-suez', extraRestrictions: ['suez', 'babelmandeb'] },
  { label: 'no-panama', extraRestrictions: ['panama'] },
  { label: 'no-suez-no-panama', extraRestrictions: ['suez', 'babelmandeb', 'panama'] },
  { label: 'no-malacca', extraRestrictions: ['malacca'] },
  { label: 'no-gibraltar', extraRestrictions: ['gibraltar'] },
];

/**
 * Return up to `k` alternative routes between two points.
 *
 * Pure Yen's algorithm requires graph-level edge manipulation we don't have
 * cheap access to via `geojson-path-finder`. Instead we use a "canal
 * permutation" variant: each alternative blocks a different combination of
 * major canals/straits (Suez+Bab-el-Mandeb, Panama, Malacca, Gibraltar,
 * etc.). The K shortest distinct routes are returned, sorted by length.
 *
 * In practice this is what real users want — alternative routings are
 * almost always about "what if Suez is closed?", not graph-level deviations
 * of a few nodes.
 *
 * Routes whose length is within `similarityThreshold` of an already-accepted
 * route are filtered out as duplicates.
 */
export function seaRouteAlternatives(
  origin: PointInput,
  destination: PointInput,
  options: SeaRouteAlternativesOptions = {},
): SeaRouteAlternative[] {
  const k = Math.max(1, options.k ?? 3);
  const sim = options.similarityThreshold ?? 0.02;
  const baseRestrictions = options.restrictions ?? [];

  const candidates: { route: SeaRouteFeature; label: string; lengthKm: number }[] = [];

  for (const variant of ALTERNATIVE_VARIANTS) {
    const variantRestrictions = Array.from(
      new Set<Passage>([...baseRestrictions, ...variant.extraRestrictions]),
    );
    try {
      const r = seaRoute(origin, destination, {
        ...options,
        // Alternatives are compared and returned as wrapped LineStrings; the
        // antimeridian representation is a per-route concern the caller can
        // re-apply with seaRoute if needed.
        antimeridian: undefined,
        restrictions: variantRestrictions,
        returnPassages: true,
      });
      const lengthKm = r.properties.length * unitToKm(r.properties.units);
      candidates.push({ route: r, label: variant.label, lengthKm });
    } catch {
      // Variant might be infeasible (e.g. blocking both Suez and Panama for
      // a route where they're the only options). Skip silently.
    }
  }

  candidates.sort((a, b) => a.lengthKm - b.lengthKm);

  const accepted: typeof candidates = [];
  for (const c of candidates) {
    const dup = accepted.some(
      (a) => Math.abs(a.lengthKm - c.lengthKm) / Math.max(a.lengthKm, 1) < sim,
    );
    if (!dup) accepted.push(c);
    if (accepted.length >= k) break;
  }

  if (accepted.length === 0) throw new NoRouteError();

  return accepted.map(({ route, label }) => {
    const out = route as SeaRouteAlternative;
    out.properties = { ...out.properties, variant: label };
    return out;
  });
}

/** Options for {@link loadNetwork}. */
export type LoadNetworkOptions = {
  /**
   * Custom fetch implementation. Defaults to the global `fetch` (available on
   * Node ≥18, which this package requires, and in all browsers). Pass one for
   * older runtimes or to inject auth/proxy behaviour.
   */
  fetch?: typeof fetch;
};

/**
 * Fetch a maritime network from a URL, for use with the `network` option.
 *
 * The bundled network (`DEFAULT_MARNET`) stays the default — this is purely
 * opt-in, for consumers who prefer to fetch the network from a CDN/host (to
 * trim their bundle, or to use an updated network without upgrading the
 * package) instead of shipping the embedded copy. `seaRoute` itself remains
 * synchronous and offline; only the network fetch is async.
 *
 * ```ts
 * const network = await loadNetwork('https://mayurrawte.github.io/searoute-ts/marnet.json');
 * const route = seaRoute(origin, destination, { network });
 * ```
 *
 * @throws {Error} on a non-OK HTTP response, or when the payload is not a
 *   GeoJSON `FeatureCollection`.
 */
export async function loadNetwork(
  url: string,
  options: LoadNetworkOptions = {},
): Promise<MarnetNetwork> {
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new Error(
      'loadNetwork: no fetch implementation available — pass options.fetch on runtimes without a global fetch',
    );
  }
  const res = await doFetch(url);
  if (!res.ok) {
    throw new Error(`loadNetwork: failed to fetch ${url} (HTTP ${res.status})`);
  }
  const data = (await res.json()) as unknown;
  if (
    !data ||
    typeof data !== 'object' ||
    (data as { type?: unknown }).type !== 'FeatureCollection' ||
    !Array.isArray((data as { features?: unknown }).features)
  ) {
    throw new Error(`loadNetwork: ${url} is not a GeoJSON FeatureCollection`);
  }
  return data as MarnetNetwork;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Build the output feature from route coordinates, applying the antimeridian
 * option: `'split'` yields a `MultiLineString` cut at ±180°, `'unwrap'` yields a
 * continuous `LineString` (longitudes may exceed ±180°), and the default leaves
 * the coordinates wrapped as computed.
 */
function buildRouteFeature(
  coords: Position[],
  properties: SeaRouteProperties,
  antimeridian?: Antimeridian,
): SeaRouteFeature | SeaRouteMultiFeature {
  if (antimeridian === 'split') {
    const ml = multiLineString(splitAtAntimeridian(coords)) as SeaRouteMultiFeature;
    ml.properties = properties;
    return ml;
  }
  const outCoords = antimeridian === 'unwrap' ? unwrapCoords(coords) : coords;
  const ls = lineString(outCoords) as SeaRouteFeature;
  ls.properties = properties;
  return ls;
}

function unitToKm(u: Units): number {
  // Hard-code the conversions we care about; @turf doesn't export a helper.
  switch (u) {
    case 'kilometers':
      return 1;
    case 'meters':
      return 0.001;
    case 'miles':
      return 1.609344;
    case 'nauticalmiles':
      return 1.852;
    case 'feet':
      return 0.0003048;
    case 'inches':
      return 0.0000254;
    case 'yards':
      return 0.0009144;
    case 'centimeters':
    case 'centimetres':
      return 0.00001;
    case 'millimeters':
    case 'millimetres':
      return 0.000001;
    default:
      // Degrees / radians don't have a fixed km equivalent. Use a reasonable
      // proxy that won't NaN out detour ratios: treat as unknown → 1 km.
      return 1;
  }
}

function convertKm(km: number, to: Units): number {
  return km / unitToKm(to);
}

export default seaRoute;
