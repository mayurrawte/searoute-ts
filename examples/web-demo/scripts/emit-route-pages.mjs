// Writes the static route pages, a page per port and a /routes/ index to
// public/ so Vite copies them into dist/, plus a sitemap listing them all.
// Generated at build time (not committed).
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  computeRoute,
  LANES,
  portCodes,
  relatedRoutes,
  renderPortPage,
  renderRoutePage,
  renderRoutesIndex,
  renderSitemap,
  routePairs,
  siteUrls,
} from './route-pages.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(scriptsDir, '..', 'public');
const routesDir = join(publicDir, 'routes');
const portsDir = join(publicDir, 'ports');
for (const dir of [routesDir, portsDir]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
copyFileSync(join(scriptsDir, 'route.css'), join(routesDir, 'route.css'));

const write = (dir, html) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
};

const routes = routePairs(LANES).map(([from, to]) => computeRoute(from, to));
for (const route of routes) {
  write(join(routesDir, route.slug), renderRoutePage(route, relatedRoutes(route, routes)));
}
const ports = portCodes(routes);
for (const code of ports) write(join(portsDir, code), renderPortPage(code, routes));
write(routesDir, renderRoutesIndex(routes));

const urls = siteUrls(routes);
writeFileSync(join(publicDir, 'sitemap.xml'), renderSitemap(urls));
console.log(`wrote ${routes.length} route pages, ${ports.length} port pages and ${urls.length} URLs to sitemap.xml`);
