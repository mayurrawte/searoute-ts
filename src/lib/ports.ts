import type { Position } from 'geojson';

/**
 * Thrown when an origin/destination given as a UN/LOCODE string cannot be
 * resolved to coordinates — either the code is unknown, or no port dataset has
 * been registered (the `searoute-ts/ports` subpath was never imported).
 */
export class UnknownPortError extends Error {
  readonly code: string;
  constructor(code: string, datasetLoaded: boolean) {
    super(
      datasetLoaded
        ? `Unknown port code '${code}'`
        : `Cannot resolve port code '${code}': no port dataset is registered. ` +
            `Import 'searoute-ts/ports' to enable UN/LOCODE lookups, or pass ` +
            `coordinates instead.`,
    );
    this.name = 'UnknownPortError';
    this.code = code;
  }
}

/** Resolves a normalized UN/LOCODE to `[lon, lat]`, or `undefined` if unknown. */
export type PortResolver = (code: string) => Position | undefined;

let activeResolver: PortResolver | undefined;

/**
 * Register the resolver used to turn UN/LOCODE strings into coordinates.
 * Called as a side effect of importing `searoute-ts/ports`; can also be used to
 * plug in a custom port dataset.
 */
export function registerPortResolver(resolver: PortResolver | undefined): void {
  activeResolver = resolver;
}

/** True when a port resolver has been registered. */
export function hasPortResolver(): boolean {
  return activeResolver !== undefined;
}

/** Normalize a UN/LOCODE: trim, upper-case, drop internal whitespace. */
export function normalizePortCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Resolve a UN/LOCODE string to `[lon, lat]`.
 *
 * @throws {UnknownPortError} when no resolver is registered or the code is
 *   not in the dataset.
 */
export function resolvePortCode(code: string): Position {
  const normalized = normalizePortCode(code);
  const coord = activeResolver ? activeResolver(normalized) : undefined;
  if (!coord) throw new UnknownPortError(code, activeResolver !== undefined);
  return coord;
}

/** A UN/LOCODE → port record map, as fetched by {@link loadPorts}. */
export type PortDataset = Record<
  string,
  { name?: string; country?: string; coordinates: [number, number] }
>;

/** Options for {@link loadPorts}. */
export type LoadPortsOptions = {
  /** Custom fetch (defaults to the global `fetch`; Node ≥18 and browsers). */
  fetch?: typeof fetch;
};

/**
 * Fetch the UN/LOCODE port dataset from a URL and register it, enabling
 * `seaRoute('CNSHA', 'NLRTM')` without bundling the `searoute-ts/ports` subpath.
 *
 * The dataset is also published as a raw `dist/ports.json`, so it is served
 * versioned by the npm CDNs — e.g.
 * `https://cdn.jsdelivr.net/npm/searoute-ts@latest/dist/ports.json` (or pin a
 * version like `@2.1.0` for reproducibility). You can also point at your own host.
 *
 * ```ts
 * await loadPorts('https://cdn.jsdelivr.net/npm/searoute-ts@latest/dist/ports.json');
 * const route = seaRoute('CNSHA', 'NLRTM');
 * ```
 *
 * Calling it registers the resolver as a side effect (like importing
 * `searoute-ts/ports`) and returns the dataset.
 *
 * @throws {Error} on a non-OK HTTP response, or when the payload is not a
 *   UN/LOCODE → port record object.
 */
export async function loadPorts(url: string, options: LoadPortsOptions = {}): Promise<PortDataset> {
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new Error(
      'loadPorts: no fetch implementation available — pass options.fetch on runtimes without a global fetch',
    );
  }
  const res = await doFetch(url);
  if (!res.ok) {
    throw new Error(`loadPorts: failed to fetch ${url} (HTTP ${res.status})`);
  }
  const data = (await res.json()) as unknown;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`loadPorts: ${url} is not a UN/LOCODE → port record object`);
  }
  const dataset = data as PortDataset;
  registerPortResolver((code) => dataset[code]?.coordinates);
  return dataset;
}
