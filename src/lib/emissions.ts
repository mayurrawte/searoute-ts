/**
 * Rough CO₂e estimation.
 *
 * The estimate is deliberately simple — `co2eTonnes ≈ distanceKm × factor` —
 * and is NOT a certified figure. Per-class factors are DERIVED transparently
 * from a representative at-sea main-engine fuel burn and service speed:
 *
 *   factorKgPerKm = fuelTonnesPerDay × CO2_PER_TONNE_FUEL × 1000
 *                 / (24 h × serviceSpeedKnots × 1.852 km/nm)
 *
 * `CO2_PER_TONNE_FUEL` is the IMO conversion factor for heavy fuel oil (HFO).
 * These are order-of-magnitude values for quick comparisons; supply your own
 * `co2eFactorKgPerKm` for anything better, and consider the GLEC recommendation
 * to inflate shortest-path distance by ~15 % for real-world deviations
 * (`glecInflation: 0.15`).
 *
 * Sources: IMO Fourth GHG Study 2020 (CO₂ conversion factor, typical fuel
 * consumption ranges); GLEC Framework v3 (distance-uplift guidance).
 */

/** Tonnes of CO₂ per tonne of heavy fuel oil burned (IMO Cf for HFO). */
export const CO2_PER_TONNE_FUEL = 3.114;

/** A vessel class with the representative figures its CO₂e factor is derived from. */
export type VesselClassSpec = {
  /** Representative at-sea main-engine fuel burn, tonnes/day. */
  fuelTonnesPerDay: number;
  /** Representative service speed, knots. */
  serviceSpeedKnots: number;
};

/** Named vessel classes accepted by the `vesselClass` option. */
export type VesselClass = 'feeder' | 'handysize' | 'panamax' | 'postpanamax' | 'capesize' | 'vlcc';

/** Representative figures per class (see module doc for the derivation). */
export const VESSEL_CLASSES: Record<VesselClass, VesselClassSpec> = {
  feeder: { fuelTonnesPerDay: 40, serviceSpeedKnots: 16 },
  handysize: { fuelTonnesPerDay: 25, serviceSpeedKnots: 13 },
  panamax: { fuelTonnesPerDay: 45, serviceSpeedKnots: 14 },
  postpanamax: { fuelTonnesPerDay: 90, serviceSpeedKnots: 18 },
  capesize: { fuelTonnesPerDay: 55, serviceSpeedKnots: 14 },
  vlcc: { fuelTonnesPerDay: 70, serviceSpeedKnots: 15 },
};

/** Derive the CO₂e emission factor (kg CO₂e per km) for a vessel class. */
export function co2eFactorKgPerKm(cls: VesselClass): number {
  const { fuelTonnesPerDay, serviceSpeedKnots } = VESSEL_CLASSES[cls];
  return (fuelTonnesPerDay * CO2_PER_TONNE_FUEL * 1000) / (24 * serviceSpeedKnots * 1.852);
}
