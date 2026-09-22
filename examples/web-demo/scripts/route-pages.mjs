// Static, script-free route pages for common port pairs (issue #31). Each page
// doubles as a pre-filled deep link into the demo. `emit-route-pages.mjs`
// writes them to public/routes/ at build time.
import { createRequire } from 'node:module';

import { CANAL_MAX_DRAFT_M, PASSAGE_BBOXES, seaRoute } from 'searoute-ts';
import 'searoute-ts/eca';
import { lookupPort } from 'searoute-ts/ports';

export const SITE = 'https://mayurrawte.is-a.dev/searoute-ts/';
const VERSION = createRequire(import.meta.url)('searoute-ts/package.json').version;

const SPEEDS = [14, 18, 22];
// A typical large container ship; the CO₂e figure is only as good as this guess.
const VESSEL_CLASS = 'postpanamax';
// The demo's default draft, so "Open in interactive demo" shows the same route.
const DRAFT_M = 14;

// Main container hubs grouped into trade lanes. Every origin is paired with
// every destination of its lane, in both directions.
export const LANES = [
  // Asia – North Europe
  { from: ['CNSHA', 'CNNGB', 'CNSZX', 'CNQIN', 'HKHKG', 'KRPUS', 'SGSIN'], to: ['NLRTM', 'BEANR', 'DEHAM', 'GBFXT'] },
  // Asia – Mediterranean
  { from: ['CNSHA', 'CNNGB', 'SGSIN'], to: ['GRPIR', 'ITGOA', 'ESVLC', 'ESALG'] },
  // Transpacific
  { from: ['CNSHA', 'CNNGB', 'CNSZX', 'HKHKG', 'KRPUS', 'JPYOK'], to: ['USLAX', 'USLGB', 'USSEA'] },
  { from: ['CNSHA', 'KRPUS'], to: ['CAVAN'] },
  // Asia – US East and Gulf coasts
  { from: ['CNSHA', 'CNNGB', 'CNSZX', 'SGSIN'], to: ['USNYC', 'USSAV', 'USHOU'] },
  // Transatlantic
  { from: ['NLRTM', 'BEANR', 'DEHAM', 'GBFXT'], to: ['USNYC', 'USSAV', 'USHOU'] },
  // Asia – Middle East and South Asia
  { from: ['CNSHA', 'CNNGB', 'SGSIN'], to: ['AEJEA', 'INNSA', 'LKCMB', 'SAJED'] },
  // Europe – Middle East and South Asia
  { from: ['NLRTM', 'BEANR', 'DEHAM'], to: ['AEJEA', 'INNSA', 'SAJED'] },
  // Intra-Asia
  { from: ['CNSHA'], to: ['SGSIN', 'KRPUS', 'JPYOK'] },
  { from: ['SGSIN'], to: ['HKHKG', 'THLCH', 'VNSGN', 'KRPUS', 'JPYOK'] },
  { from: ['MYPKG'], to: ['CNSHA', 'NLRTM'] },
  // South America
  { from: ['BRSSZ'], to: ['NLRTM', 'DEHAM', 'CNSHA', 'SGSIN', 'USNYC'] },
  { from: ['CLSAI'], to: ['CNSHA', 'USLAX'] },
  { from: ['ARBUE'], to: ['NLRTM'] },
  { from: ['PECLL'], to: ['CNSHA'] },
  // Africa
  { from: ['ZADUR'], to: ['CNSHA', 'SGSIN', 'NLRTM'] },
  { from: ['NGLOS'], to: ['NLRTM', 'CNSHA'] },
  { from: ['KEMBA'], to: ['SGSIN'] },
  // Oceania
  { from: ['AUSYD'], to: ['CNSHA', 'SGSIN', 'USLAX'] },
  { from: ['AUMEL'], to: ['CNSHA', 'SGSIN'] },
  { from: ['NZAKL'], to: ['CNSHA', 'USLAX'] },
  // Mediterranean gateways
  { from: ['EGPSD'], to: ['NLRTM', 'SGSIN', 'CNSHA'] },
  { from: ['MAPTM'], to: ['NLRTM', 'CNSHA'] },
  { from: ['TRIST'], to: ['NLRTM'] },
  // Coastal and intra-Europe
  { from: ['USNYC'], to: ['USLAX'] },
  { from: ['USHOU'], to: ['USLAX'] },
  { from: ['NLRTM'], to: ['ESALG'] },
  { from: ['DEHAM'], to: ['GRPIR'] },
];

const PASSAGE_NAMES = {
  suez: 'Suez Canal',
  panama: 'Panama Canal',
  gibraltar: 'Strait of Gibraltar',
  babelmandeb: 'Bab-el-Mandeb',
  babalmandab: 'Bab-el-Mandeb',
  bosporus: 'Bosporus',
  ormuz: 'Strait of Hormuz',
  malacca: 'Strait of Malacca',
  sunda: 'Sunda Strait',
  dover: 'Dover Strait',
  kiel: 'Kiel Canal',
  corinth: 'Corinth Canal',
  bering: 'Bering Strait',
  magellan: 'Strait of Magellan',
  cape_horn: 'Cape Horn',
  northwest: 'Northwest Passage',
  northeast: 'Northeast Passage',
};

// Passages worth naming in the title, most telling first.
const HEADLINE = ['suez', 'panama', 'kiel', 'corinth', 'magellan', 'cape_horn', 'northwest', 'northeast'];
const SHORT_NAMES = { suez: 'Suez', panama: 'Panama' };

export function routeSlug(from, to) {
  return `${from}-${to}`.toUpperCase();
}

export function routeUrl(slug) {
  return `${SITE}routes/${slug}/`;
}

export function routePairs(lanes) {
  const seen = new Set();
  const pairs = [];
  for (const lane of lanes) {
    for (const a of lane.from) {
      for (const b of lane.to) {
        for (const pair of [[a, b], [b, a]]) {
          for (const code of pair) {
            if (!lookupPort(code)) throw new Error(`Unknown port code in LANES: ${code}`);
          }
          const slug = routeSlug(...pair);
          if (seen.has(slug)) continue;
          seen.add(slug);
          pairs.push(pair);
        }
      }
    }
  }
  return pairs;
}

function port(code) {
  const p = lookupPort(code);
  return { code: p.code, name: p.name, country: p.country, coord: p.coordinates };
}

export function computeRoute(fromCode, toCode) {
  const from = port(fromCode);
  const to = port(toCode);
  const route = seaRoute(from.code, to.code, {
    vesselDraftMeters: DRAFT_M,
    returnPassages: true,
    emissions: true,
    vesselClass: VESSEL_CLASS,
    antimeridian: 'unwrap',
  });
  const { length: nm, ecaKm, co2eTonnes } = route.properties;
  // A canal too shallow for DRAFT_M is blocked, so a hit on it is the
  // approach clipping its bounding box (Hamburg and the Kiel Canal).
  const passages = (route.properties.passages ?? []).filter((p) => !(CANAL_MAX_DRAFT_M[p] < DRAFT_M));

  let suezClosed;
  if (passages.includes('suez')) {
    const alt = seaRoute(from.code, to.code, {
      restrictions: ['suez'],
      vesselDraftMeters: DRAFT_M,
      returnPassages: true,
    });
    const altPassages = alt.properties.passages ?? [];
    const via = ['panama', 'magellan', 'cape_horn'].find((p) => altPassages.includes(p));
    suezClosed = {
      nm: alt.properties.length,
      passages: altPassages,
      via: via ? `the ${PASSAGE_NAMES[via]}` : 'the Cape of Good Hope',
    };
  }

  return {
    slug: routeSlug(from.code, to.code),
    from,
    to,
    nm,
    km: nm * 1.852,
    passages,
    headline: HEADLINE.find((p) => passages.includes(p)),
    etaDays: Object.fromEntries(SPEEDS.map((kn) => [kn, nm / kn / 24])),
    suezClosed,
    ecaKm,
    co2eTonnes,
    line: route.geometry.coordinates,
  };
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const days = (d) => d.toFixed(1);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

const place = (p) => `${p.name}, ${p.country}`;

function routeTitle(r) {
  const via = r.headline ? ` via ${SHORT_NAMES[r.headline] ?? `the ${PASSAGE_NAMES[r.headline]}`}` : '';
  return `${r.from.name} to ${r.to.name} sea distance: ${fmt(r.nm)} nm${via}`;
}

function routeDescription(r) {
  const via = r.headline ? ` via the ${PASSAGE_NAMES[r.headline]}` : '';
  return (
    `Sea distance from ${place(r.from)} (${r.from.code}) to ${place(r.to)} (${r.to.code}): ` +
    `${fmt(r.nm)} nm (${fmt(r.km)} km)${via}. About ${days(r.etaDays[14])} days at 14 knots. ` +
    `Computed with searoute-ts.`
  );
}

function suezDelta(r) {
  const extra = r.suezClosed.nm - r.nm;
  return `${fmt(extra)} nm (${Math.round((extra / r.nm) * 100)}%)`;
}

function structuredData(r, url) {
  const faq = [
    {
      q: `How far is ${r.from.name} from ${r.to.name} by sea?`,
      a: `${fmt(r.nm)} nautical miles (${fmt(r.km)} km) on the shortest sea route${r.headline ? `, via the ${PASSAGE_NAMES[r.headline]}` : ''}.`,
    },
    {
      q: `How long does it take to sail from ${r.from.name} to ${r.to.name}?`,
      a: SPEEDS.map((kn) => `${days(r.etaDays[kn])} days at ${kn} knots`).join(', ') + ', not counting port time.',
    },
  ];
  if (r.suezClosed) {
    faq.push({
      q: `How far is ${r.from.name} to ${r.to.name} if the Suez Canal is closed?`,
      a: `${fmt(r.suezClosed.nm)} nautical miles via ${r.suezClosed.via}, ${suezDelta(r)} longer.`,
    });
  }
  const geoPlace = (p) => ({
    '@type': 'Place',
    name: place(p),
    geo: { '@type': 'GeoCoordinates', latitude: p.coord[1], longitude: p.coord[0] },
  });
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: routeTitle(r),
        description: routeDescription(r),
        isPartOf: { '@type': 'WebSite', name: 'searoute-ts', url: SITE },
        about: [geoPlace(r.from), geoPlace(r.to)],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// Equirectangular, squeezed by cos(latitude) so mid-latitude routes don't
// look stretched. The line is already unwrapped across the antimeridian.
function routeSvg(r) {
  const lons = r.line.map((c) => c[0]);
  const lats = r.line.map((c) => c[1]);
  let [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const pad = Math.max(3, (maxLon - minLon) * 0.06, (maxLat - minLat) * 0.06);
  minLon -= pad;
  maxLon += pad;
  minLat = Math.max(-85, minLat - pad);
  maxLat = Math.min(85, maxLat + pad);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const s = Math.min(640 / ((maxLon - minLon) * k), 360 / (maxLat - minLat));
  const w = Math.round((maxLon - minLon) * k * s);
  const h = Math.round((maxLat - minLat) * s);
  const x = (lon) => ((lon - minLon) * k * s).toFixed(1);
  const y = (lat) => ((maxLat - lat) * s).toFixed(1);

  const step = maxLon - minLon > 120 ? 30 : maxLon - minLon > 40 ? 10 : 5;
  const grid = [];
  for (let lon = Math.ceil(minLon / step) * step; lon <= maxLon; lon += step) {
    grid.push(`M${x(lon)} 0V${h}`);
  }
  for (let lat = Math.ceil(minLat / step) * step; lat <= maxLat; lat += step) {
    grid.push(`M0 ${y(lat)}H${w}`);
  }

  const d = r.line.map(([lon, lat], i) => `${i ? 'L' : 'M'}${x(lon)} ${y(lat)}`).join('');
  const label = (lon, lat, text, cls) => {
    const anchor = Number(x(lon)) > w / 2 ? 'end' : 'start';
    const dx = anchor === 'end' ? -8 : 8;
    return (
      `<circle class="${cls}" cx="${x(lon)}" cy="${y(lat)}" r="${cls === 'port' ? 5 : 3}"/>` +
      `<text class="${cls}" x="${(Number(x(lon)) + dx).toFixed(1)}" y="${y(lat)}" dy="4" text-anchor="${anchor}">${esc(text)}</text>`
    );
  };

  const [first, last] = [r.line[0], r.line[r.line.length - 1]];
  // A passage right next to a port would print its label over the port's.
  const clear = (lon, lat) =>
    [first, last].every((c) => Math.hypot(x(lon) - x(c[0]), y(lat) - y(c[1])) > 24);

  const midLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const marks = r.passages
    .filter((p) => p !== 'babalmandab' && PASSAGE_BBOXES[p])
    .map((p) => {
      const [x0, y0, x1, y1] = PASSAGE_BBOXES[p][0];
      let lon = (x0 + x1) / 2;
      while (lon - midLon > 180) lon -= 360;
      while (midLon - lon > 180) lon += 360;
      return [lon, (y0 + y1) / 2, PASSAGE_NAMES[p]];
    })
    .filter(([lon, lat]) => clear(lon, lat))
    .map(([lon, lat, name]) => label(lon, lat, name, 'passage'));

  return (
    `<svg class="route-map" viewBox="0 0 ${w} ${h}" role="img" aria-label="Map of the sea route from ${esc(r.from.name)} to ${esc(r.to.name)}">` +
    `<path class="grid" d="${grid.join('')}"/>` +
    `<path class="route" d="${d}"/>` +
    marks.join('') +
    label(first[0], first[1], r.from.name, 'port') +
    label(last[0], last[1], r.to.name, 'port') +
    `</svg>`
  );
}

function codeSnippet(r) {
  return `import { seaRoute } from 'searoute-ts';
import 'searoute-ts/ports';

const route = seaRoute('${r.from.code}', '${r.to.code}', { vesselDraftMeters: ${DRAFT_M} });
console.log(route.properties.length); // ${fmt(r.nm)} nm`;
}

export function renderRoutePage(r) {
  const url = routeUrl(r.slug);
  const title = routeTitle(r);
  const description = routeDescription(r);
  const demo = `../../?from=${r.from.code}&to=${r.to.code}`;
  const passages = r.passages.filter((p) => p !== 'babalmandab');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="searoute-ts" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" type="image/svg+xml" href="../../favicon.svg" />
    <link rel="stylesheet" href="../route.css" />
    <script type="application/ld+json">${structuredData(r, url)}</script>
  </head>
  <body>
    <main>
      <nav class="crumbs"><a href="../../">⚓︎ searoute-ts</a></nav>
      <h1>${esc(r.from.name)} to ${esc(r.to.name)} sea distance</h1>
      <p class="lede">
        ${esc(place(r.from))} (${r.from.code}) to ${esc(place(r.to))} (${r.to.code}) is
        <strong>${fmt(r.nm)} nautical miles</strong> (${fmt(r.km)} km) by sea${r.headline ? `, via the ${PASSAGE_NAMES[r.headline]}` : ''}.
      </p>
      <p><a class="cta" href="${esc(demo)}">Open in interactive demo →</a></p>
      <figure>
        ${routeSvg(r)}
      </figure>

      <h2>Distance and sailing time</h2>
      <table>
        <tbody>
          <tr><th scope="row">Distance</th><td>${fmt(r.nm)} nm · ${fmt(r.km)} km</td></tr>
${SPEEDS.map((kn) => `          <tr><th scope="row">At ${kn} knots</th><td>${days(r.etaDays[kn])} days (${fmt(r.etaDays[kn] * 24)} h)</td></tr>`).join('\n')}
        </tbody>
      </table>
      <p class="note">Time at sea only, excluding port calls, canal waiting and weather.</p>

      <h2>Passages</h2>
      ${passages.length ? `<ul>${passages.map((p) => `<li>${PASSAGE_NAMES[p]}</li>`).join('')}</ul>` : '<p>No named canals or straits on this route.</p>'}
${r.suezClosed ? `
      <h2>With Suez closed</h2>
      <p>
        Avoiding the Suez Canal, the shortest route is <strong>${fmt(r.suezClosed.nm)} nm</strong>
        (${fmt(r.suezClosed.nm * 1.852)} km) via ${r.suezClosed.via}: ${suezDelta(r)} longer, or about
        ${days((r.suezClosed.nm - r.nm) / 14 / 24)} extra days at 14 knots.
      </p>
` : ''}
      <h2>Emissions estimate</h2>
      <table>
        <tbody>
          <tr><th scope="row">Inside ECA/SECA zones</th><td>${fmt(r.ecaKm)} km (${Math.round((r.ecaKm / r.km) * 100)}% of the route)</td></tr>
          <tr><th scope="row">CO₂e</th><td>≈ ${fmt(r.co2eTonnes)} t</td></tr>
        </tbody>
      </table>
      <p class="note">Rough estimate for a post-Panamax container ship, not a certified figure. ECA share uses bounding boxes.</p>

      <h2>Compute it yourself</h2>
      <pre><code>${esc(codeSnippet(r))}</code></pre>
      <p><code>npm install searoute-ts</code> · <a href="https://github.com/mayurrawte/searoute-ts">GitHub</a> · <a href="https://www.npmjs.com/package/searoute-ts">npm</a></p>

      <footer>
        Computed with searoute-ts ${VERSION} on the Eurostat marnet network. Shortest-path estimates, not for navigation.
      </footer>
    </main>
  </body>
</html>
`;
}

export function renderSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}
</urlset>
`;
}
