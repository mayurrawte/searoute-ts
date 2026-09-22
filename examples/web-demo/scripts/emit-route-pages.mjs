// Writes the static route pages to public/routes/ so Vite copies them into
// dist/routes/<FROM>-<TO>/index.html, plus a sitemap listing them. Generated
// at build time (not committed).
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  computeRoute,
  LANES,
  renderRoutePage,
  renderSitemap,
  routePairs,
  routeUrl,
  SITE,
} from './route-pages.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(scriptsDir, '..', 'public');
const outDir = join(publicDir, 'routes');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
copyFileSync(join(scriptsDir, 'route.css'), join(outDir, 'route.css'));

const pairs = routePairs(LANES);
const urls = [SITE];
for (const [from, to] of pairs) {
  const route = computeRoute(from, to);
  const dir = join(outDir, route.slug);
  mkdirSync(dir);
  writeFileSync(join(dir, 'index.html'), renderRoutePage(route));
  urls.push(routeUrl(route.slug));
}
writeFileSync(join(publicDir, 'sitemap.xml'), renderSitemap(urls));
console.log(`wrote ${pairs.length} route pages to ${outDir} and ${urls.length} URLs to sitemap.xml`);
