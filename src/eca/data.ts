import type { EcaZone } from '../lib/eca.js';

/**
 * Default emission-control-area (ECA/SECA) zones, approximated by bounding-box
 * envelopes of each area's sea extent.
 *
 * These are ROUGH approximations of the IMO MARPOL Annex VI designated areas —
 * good enough for the estimate `properties.ecaKm` reports, but not authoritative
 * boundaries. The North American and US Caribbean ECAs in particular follow a
 * 200 nm offset from the baseline; here they are coarse coastal envelopes. Swap
 * in higher-fidelity polygons via `registerEcaZones` when precision matters.
 *
 * Coverage (SOx/SECA and combined ECAs):
 * - Baltic Sea SECA
 * - North Sea SECA (incl. the English Channel)
 * - Mediterranean Sea SECA (in force 1 May 2025)
 * - North American ECA (Pacific, Atlantic, Gulf of Mexico coasts)
 * - US Caribbean ECA (Puerto Rico & the US Virgin Islands)
 *
 * Sources: IMO MARPOL Annex VI, Regulations 13 & 14 and Appendix VII (ECA
 * definitions); Mediterranean SECA adopted at MEPC 79 (in force 2025-05-01).
 */
const DEFAULT_ECA_ZONES: EcaZone[] = [
  {
    name: 'Baltic Sea SECA',
    bboxes: [
      [12.0, 53.6, 30.5, 66.0],
      [10.5, 55.3, 13.0, 58.2],
    ],
  },
  {
    name: 'North Sea SECA',
    bboxes: [
      [-2.0, 51.0, 9.0, 62.0],
      [-5.5, 48.5, 2.0, 51.2],
    ],
  },
  {
    name: 'Mediterranean Sea SECA',
    bboxes: [
      [-6.0, 30.0, 26.0, 46.0],
      [22.0, 30.0, 37.0, 41.0],
    ],
  },
  {
    name: 'North American ECA',
    bboxes: [
      [-130.0, 30.0, -116.0, 49.5],
      [-77.0, 25.0, -60.0, 47.0],
      [-98.0, 24.0, -80.0, 31.0],
    ],
  },
  {
    name: 'US Caribbean ECA',
    bboxes: [[-68.5, 16.5, -63.5, 20.0]],
  },
];

export default DEFAULT_ECA_ZONES;
