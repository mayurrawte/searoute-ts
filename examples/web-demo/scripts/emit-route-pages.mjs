// Writes the static route pages to public/routes/ so Vite copies them into
// dist/routes/<FROM>-<TO>/index.html. Generated at build time (not committed).
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { computeRoute, LANES, renderRoutePage, routePairs } from './route-pages.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptsDir, '..', 'public', 'routes');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
copyFileSync(join(scriptsDir, 'route.css'), join(outDir, 'route.css'));

const pairs = routePairs(LANES);
for (const [from, to] of pairs) {
  const route = computeRoute(from, to);
  const dir = join(outDir, route.slug);
  mkdirSync(dir);
  writeFileSync(join(dir, 'index.html'), renderRoutePage(route));
}
console.log(`wrote ${pairs.length} route pages to ${outDir}`);
