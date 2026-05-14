import type { Passage } from './restrictions.js';

/**
 * Maximum allowable vessel draft for each canal, in metres.
 * Sources: canal authorities (2025 figures).
 *
 * - Panama: 15.2 m TFW (Tropical Fresh Water) — Neopanamax / Agua Clara locks.
 *   Old Panamax locks allow only 12.04 m.
 * - Suez: 20.1 m at full beam, can go to 23 m for vessels narrower than 50 m
 *   beam (we use the conservative 20.1 m as the default ceiling).
 * - Kiel: 7.0 m for transit; 9.5 m for the upper section of the channel.
 * - Corinth: 7.3 m.
 *
 * If a vessel's declared draft exceeds the canal limit, the canal is
 * auto-added to the route's restrictions list.
 *
 * Sources:
 *   https://pancanal.com/ (Panama Canal Authority)
 *   https://www.suezcanal.gov.eg/ (Suez Canal Authority)
 *   https://www.kiel-canal.de/
 */
export const CANAL_MAX_DRAFT_M: Partial<Record<Passage, number>> = {
  panama: 15.2,
  suez: 20.1,
  kiel: 7.0,
  corinth: 7.3,
};

/**
 * Given a vessel's declared draft, return the passages it cannot transit.
 * Other passages (open straits, etc.) are not affected by draft.
 */
export function passagesBlockedByDraft(draftMeters: number): Passage[] {
  if (!Number.isFinite(draftMeters) || draftMeters <= 0) return [];
  const blocked: Passage[] = [];
  for (const [passage, limit] of Object.entries(CANAL_MAX_DRAFT_M)) {
    if (limit !== undefined && draftMeters > limit) {
      blocked.push(passage as Passage);
    }
  }
  return blocked;
}
