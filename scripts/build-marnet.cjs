/* Generate src/lib/marnet.ts from the eurostat marnet_plus_100km GeoJSON.
 * Embeds the data as a JSON string + JSON.parse() so the TypeScript compiler
 * doesn't pretty-print a 1 MB object literal into a 2.8 MB JS module.
 *
 * Run manually when refreshing the network:
 *   node scripts/build-marnet.cjs /path/to/marnet_plus_100km.geojson
 */
const fs = require('fs');
const path = require('path');

const input = process.argv[2] || '/tmp/eurostat-marnet/marnet_plus_100km.geojson';
const outPath = path.resolve(__dirname, '..', 'src/lib/marnet.ts');

const src = fs.readFileSync(input, 'utf8');
const parsed = JSON.parse(src);

// Antimeridian normalization: collapse lon=180 onto lon=-180 so the eastern
// and western Pacific share a single graph vertex.
let touched = 0;
for (const f of parsed.features) {
  for (const c of f.geometry.coordinates) {
    if (c[0] === 180) {
      c[0] = -180;
      touched++;
    }
  }
}

const json = JSON.stringify(parsed);
if (json.includes("'") || json.includes('\\')) {
  console.error('JSON contains characters that need escaping in a JS single-quoted string');
  process.exit(1);
}

const header = `import type { FeatureCollection, LineString } from "geojson";

/**
 * Maritime network from Eurostat searoute v3.5 (marnet_plus_100km, 2025).
 * 9,847 LineString segments at ~100 km resolution with explicit \`pass\`
 * labels for Suez, Panama, Malacca, Gibraltar, Bab-el-Mandeb, Kiel,
 * Corinth, Dover, Bering, Magellan, Northwest Passage, Northeast Passage.
 *
 * Antimeridian normalization: vertices at lon === 180 are rewritten to
 * lon === -180 so the eastern and western sides of the Pacific share a
 * single graph vertex.
 *
 * Source: https://github.com/eurostat/searoute (EUPL-1.2).
 *
 * Embedded as a JSON string so the TypeScript compiler does not
 * pretty-print the 1 MB object literal (which would 2-3x the bundle size).
 * The string is parsed once at module load.
 */
export type MarnetProperties = { pass?: string };

`;

// eslint-disable-next-line prefer-template
const body =
  'const marnetData = JSON.parse(\n  \'' +
  json +
  '\',\n) as FeatureCollection<LineString, MarnetProperties>;\n\nexport default marnetData;\n';

fs.writeFileSync(outPath, header + body);
console.log('normalized', touched, 'antimeridian vertices');
console.log('wrote', outPath, '(' + (fs.statSync(outPath).size / 1024 / 1024).toFixed(2) + ' MB)');
