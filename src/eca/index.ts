import { type EcaZone, registerEcaZones } from '../lib/eca.js';
import DEFAULT_ECA_ZONES from './data.js';

export type { EcaZone } from '../lib/eca.js';
export { registerEcaZones } from '../lib/eca.js';

/**
 * The bundled default ECA/SECA zones (bounding-box approximations of the IMO
 * MARPOL Annex VI designated areas). See `src/eca/data.ts` for coverage,
 * caveats and sources.
 */
export const ECA_ZONES: readonly EcaZone[] = DEFAULT_ECA_ZONES;

// Enable `seaRoute(o, d, { emissions: true }).properties.ecaKm` in the core:
// importing this module registers the default zones. This is the module's
// intended side effect.
registerEcaZones(DEFAULT_ECA_ZONES);
