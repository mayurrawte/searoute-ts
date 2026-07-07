// Importing the ports subpath registers the UN/LOCODE resolver into the core
// (issue #7), so agents can pass port codes like 'CNSHA' as well as coordinates.
import 'searoute-ts/ports';
import {
  NoRouteError,
  SnapFailedError,
  UnknownPortError,
  seaRoute,
  seaRouteAlternatives,
  type PointInput,
  type Passage,
  type SeaRouteFeature,
} from 'searoute-ts';
import { z } from 'zod';

/** MCP tool result shape (a minimal subset of the SDK's CallToolResult). */
export type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

// ── Shared input pieces ──────────────────────────────────────────────────────

const pointSchema = z
  .union([
    z.string().min(1).describe('UN/LOCODE port code, e.g. "CNSHA" or "NLRTM"'),
    z
      .tuple([z.number().gte(-180).lte(180), z.number().gte(-90).lte(90)])
      .describe('[longitude, latitude] in decimal degrees'),
  ])
  .describe('A UN/LOCODE port code string, or a [longitude, latitude] coordinate pair.');

const unitsSchema = z
  .enum(['nauticalmiles', 'kilometers', 'miles'])
  .default('nauticalmiles')
  .describe('Unit for the returned distance.');

/** Named canals/straits the route may be forbidden to (or forced away from) use. */
export const PASSAGE_NAMES = [
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
] as const;

const restrictionsSchema = z
  .array(z.enum(PASSAGE_NAMES))
  .optional()
  .describe(
    'Named passages the route must avoid. e.g. ["suez","babelmandeb"] forces Cape of Good Hope routing during a Red Sea disruption.',
  );

const commonOptions = {
  units: unitsSchema,
  restrictions: restrictionsSchema,
  allowArctic: z
    .boolean()
    .optional()
    .describe('Allow the ice-blocked Northwest/Northeast Passages (blocked by default).'),
  speedKnots: z
    .number()
    .positive()
    .optional()
    .describe('Vessel speed in knots; when given, an estimated duration in hours is returned.'),
  vesselDraftMeters: z
    .number()
    .positive()
    .optional()
    .describe('Vessel draft in metres; canals too shallow for it are auto-avoided.'),
  maxSnapDistanceKm: z
    .number()
    .positive()
    .optional()
    .describe('Reject inputs farther than this (km) from the maritime network.'),
};

// ── sea_route ────────────────────────────────────────────────────────────────

export const seaRouteInputSchema = {
  origin: pointSchema,
  destination: pointSchema,
  ...commonOptions,
  includeGeometry: z
    .boolean()
    .default(true)
    .describe('Include the route LineString GeoJSON in the result.'),
};

const SeaRouteArgs = z.object(seaRouteInputSchema);
export type SeaRouteArgs = z.infer<typeof SeaRouteArgs>;

function summarize(feature: SeaRouteFeature): {
  distance: number;
  units: string;
  durationHours?: number;
  passages: Passage[];
  greatCircleLength: number;
  detourRatio: number;
  originSnapKm: number;
  destinationSnapKm: number;
} {
  const p = feature.properties;
  return {
    distance: Math.round(p.length * 100) / 100,
    units: p.units,
    durationHours: p.durationHours === undefined ? undefined : Math.round(p.durationHours * 100) / 100,
    passages: p.passages ?? [],
    greatCircleLength: Math.round(p.greatCircleLength * 100) / 100,
    detourRatio: Math.round(p.detourRatio * 1000) / 1000,
    originSnapKm: Math.round(p.originSnapKm * 100) / 100,
    destinationSnapKm: Math.round(p.destinationSnapKm * 100) / 100,
  };
}

function errorResult(err: unknown): ToolResult {
  const message =
    err instanceof UnknownPortError ||
    err instanceof NoRouteError ||
    err instanceof SnapFailedError
      ? `${err.name}: ${err.message}`
      : `Failed to compute route: ${err instanceof Error ? err.message : String(err)}`;
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Compute a single shortest sea route. Pure — safe to unit-test directly. */
export function runSeaRoute(args: SeaRouteArgs): ToolResult {
  try {
    const route = seaRoute(args.origin as PointInput, args.destination as PointInput, {
      units: args.units,
      restrictions: args.restrictions as Passage[] | undefined,
      allowArctic: args.allowArctic,
      speedKnots: args.speedKnots,
      vesselDraftMeters: args.vesselDraftMeters,
      maxSnapDistanceKm: args.maxSnapDistanceKm,
      returnPassages: true,
    });
    const summary = summarize(route);
    const structured: Record<string, unknown> = { ...summary };
    if (args.includeGeometry) structured.geojson = route;

    const text =
      `Sea route: ${summary.distance} ${summary.units}` +
      (summary.durationHours !== undefined ? `, ~${summary.durationHours} h` : '') +
      (summary.passages.length ? `, via ${summary.passages.join(', ')}` : '') +
      ` (detour ratio ${summary.detourRatio}).`;

    return { content: [{ type: 'text', text }], structuredContent: structured };
  } catch (err) {
    return errorResult(err);
  }
}

// ── sea_route_alternatives ───────────────────────────────────────────────────

export const seaRouteAlternativesInputSchema = {
  origin: pointSchema,
  destination: pointSchema,
  k: z
    .number()
    .int()
    .gte(1)
    .lte(6)
    .default(3)
    .describe('Maximum number of distinct alternative routes to return.'),
  units: unitsSchema,
  restrictions: restrictionsSchema,
  allowArctic: commonOptions.allowArctic,
  vesselDraftMeters: commonOptions.vesselDraftMeters,
  includeGeometry: z
    .boolean()
    .default(false)
    .describe('Include each route LineString GeoJSON in the result (off by default; verbose).'),
};

const SeaRouteAlternativesArgs = z.object(seaRouteAlternativesInputSchema);
export type SeaRouteAlternativesArgs = z.infer<typeof SeaRouteAlternativesArgs>;

/** Compute up to `k` distinct alternative routes. Pure — safe to unit-test directly. */
export function runSeaRouteAlternatives(args: SeaRouteAlternativesArgs): ToolResult {
  try {
    const routes = seaRouteAlternatives(args.origin as PointInput, args.destination as PointInput, {
      k: args.k,
      units: args.units,
      restrictions: args.restrictions as Passage[] | undefined,
      allowArctic: args.allowArctic,
      vesselDraftMeters: args.vesselDraftMeters,
    });

    const alternatives = routes.map((route) => {
      const summary = summarize(route);
      const variant = (route.properties as { variant?: string }).variant;
      const entry: Record<string, unknown> = { variant, ...summary };
      if (args.includeGeometry) entry.geojson = route;
      return entry;
    });

    const text =
      `Found ${alternatives.length} alternative route(s):\n` +
      alternatives
        .map(
          (a) =>
            `- ${a.variant}: ${a.distance} ${a.units}` +
            ((a.passages as Passage[]).length ? ` via ${(a.passages as Passage[]).join(', ')}` : ''),
        )
        .join('\n');

    return {
      content: [{ type: 'text', text }],
      structuredContent: { count: alternatives.length, alternatives },
    };
  } catch (err) {
    return errorResult(err);
  }
}
