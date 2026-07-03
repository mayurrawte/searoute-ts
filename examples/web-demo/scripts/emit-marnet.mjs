// Writes the bundled network to public/marnet.json so the GitHub Pages deploy
// serves it as a CORS-enabled reference URL for `loadNetwork()`. Generated at
// build time (not committed) — see the demo .gitignore.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DEFAULT_MARNET } from 'searoute-ts';

const demoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(demoDir, 'public');
mkdirSync(outDir, { recursive: true });

const out = join(outDir, 'marnet.json');
writeFileSync(out, JSON.stringify(DEFAULT_MARNET));
console.log(`wrote ${out} (${DEFAULT_MARNET.features.length} features)`);
