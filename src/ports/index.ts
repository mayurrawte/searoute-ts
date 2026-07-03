import { normalizePortCode, registerPortResolver, UnknownPortError } from '../lib/ports.js';
import PORT_RECORDS, { type PortRecord } from './data.js';

export { UnknownPortError } from '../lib/ports.js';
export type { PortRecord } from './data.js';

/** A resolved port: its UN/LOCODE plus name, country and `[lon, lat]`. */
export type Port = PortRecord & { code: string };

/**
 * The bundled seaport dataset, keyed by UN/LOCODE. Derived from
 * [marchah/sea-ports](https://github.com/marchah/sea-ports) (MIT), itself based
 * on UN/LOCODE. Codes include primary locations and their aliases.
 */
export const PORTS: Readonly<Record<string, PortRecord>> = PORT_RECORDS;

/** Number of UN/LOCODE keys in the bundled dataset. */
export const PORT_COUNT = Object.keys(PORT_RECORDS).length;

/**
 * Look up a port by UN/LOCODE (case-insensitive, whitespace ignored).
 * Returns `undefined` when the code is not in the dataset.
 */
export function lookupPort(code: string): Port | undefined {
  const normalized = normalizePortCode(code);
  const record = PORT_RECORDS[normalized];
  return record ? { code: normalized, ...record } : undefined;
}

/**
 * Resolve a UN/LOCODE to `[lon, lat]`.
 *
 * @throws {UnknownPortError} when the code is not in the dataset.
 */
export function resolvePort(code: string): [number, number] {
  const record = PORT_RECORDS[normalizePortCode(code)];
  if (!record) throw new UnknownPortError(code, true);
  return record.coordinates;
}

// Enable `seaRoute('CNSHA', 'NLRTM')` in the core: importing this module wires
// the UN/LOCODE resolver into it. This is the module's intended side effect.
registerPortResolver((code) => PORT_RECORDS[code]?.coordinates);
