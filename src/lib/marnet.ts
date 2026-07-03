import type { FeatureCollection, LineString } from 'geojson';

import marnetData from '../../data/marnet.cjs';

/**
 * Maritime network from Eurostat searoute v3.5 (marnet_plus_100km, 2025).
 * 9,847 LineString segments at ~100 km resolution with explicit `pass`
 * labels for Suez, Panama, Malacca, Gibraltar, Bab-el-Mandeb, Kiel,
 * Corinth, Dover, Bering, Magellan, Northwest Passage, Northeast Passage.
 *
 * Antimeridian normalization: vertices at lon === 180 are rewritten to
 * lon === -180 so the eastern and western sides of the Pacific share a
 * single graph vertex.
 *
 * Source: https://github.com/eurostat/searoute (EUPL-1.2).
 *
 * The network data itself lives in a single `data/marnet.cjs` asset that both
 * the CJS and ESM builds resolve at runtime (shipped once as
 * `dist/data/marnet.cjs`), rather than being inlined into each build. This
 * roughly halves the published package size. Generate the asset with
 * `scripts/build-marnet.cjs`.
 */
export type MarnetProperties = { pass?: string };

const marnet = marnetData as FeatureCollection<LineString, MarnetProperties>;

export default marnet;
