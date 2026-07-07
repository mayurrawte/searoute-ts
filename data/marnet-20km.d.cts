import type { FeatureCollection, LineString } from 'geojson';

/** Optional native passage label carried on marnet edges. */
export type MarnetProperties = { pass?: string };

declare const marnetData: FeatureCollection<LineString, MarnetProperties>;
export default marnetData;
