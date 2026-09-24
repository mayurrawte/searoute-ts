import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  computeRoute,
  LANES,
  portUrl,
  relatedRoutes,
  renderPortPage,
  renderRoutePage,
  renderRoutesIndex,
  renderSitemap,
  routePairs,
  routeSlug,
  routeUrl,
  SITE,
  siteUrls,
} from './route-pages.mjs';

const lone = (r) => renderRoutePage(r, relatedRoutes(r, [r]));

describe('routePairs', () => {
  it('expands a lane into both directions of every origin/destination pair', () => {
    expect(routePairs([{ from: ['CNSHA', 'SGSIN'], to: ['NLRTM'] }])).toEqual([
      ['CNSHA', 'NLRTM'],
      ['NLRTM', 'CNSHA'],
      ['SGSIN', 'NLRTM'],
      ['NLRTM', 'SGSIN'],
    ]);
  });

  it('drops a pair that two lanes both produce', () => {
    const lanes = [
      { from: ['CNSHA'], to: ['NLRTM'] },
      { from: ['NLRTM'], to: ['CNSHA'] },
    ];
    expect(routePairs(lanes)).toHaveLength(2);
  });

  it('rejects a code that is not a bundled port', () => {
    expect(() => routePairs([{ from: ['ZZZZZ'], to: ['NLRTM'] }])).toThrow('ZZZZZ');
  });

  it('curates a few hundred pages from the bundled lanes', () => {
    const n = routePairs(LANES).length;
    expect(n).toBeGreaterThanOrEqual(150);
    expect(n).toBeLessThanOrEqual(300);
  });
});

describe('routeSlug', () => {
  it('is FROM-TO in upper case', () => {
    expect(routeSlug('cnsha', 'nlrtm')).toBe('CNSHA-NLRTM');
  });
});

describe('computeRoute', () => {
  const r = computeRoute('CNSHA', 'NLRTM');

  it('matches the library for Shanghai → Rotterdam', () => {
    expect(r.from.name).toBe('Shanghai');
    expect(r.to.name).toBe('Rotterdam');
    expect(Math.round(r.nm)).toBe(10666);
    expect(r.km).toBeCloseTo(r.nm * 1.852);
    expect(r.passages).toContain('suez');
    expect(r.headline).toBe('suez');
  });

  it('works out the ETA at each speed', () => {
    expect(r.etaDays[14]).toBeCloseTo(r.nm / 14 / 24);
    expect(r.etaDays[22]).toBeCloseTo(r.nm / 22 / 24);
  });

  it('prices the Suez closure against the route that avoids it', () => {
    expect(r.suezClosed?.passages).not.toContain('suez');
    expect(r.suezClosed.nm).toBeGreaterThan(r.nm);
  });

  it('drops a canal the draft rules out, which is only its bounding box clipped', () => {
    expect(computeRoute('DEHAM', 'USNYC').passages).not.toContain('kiel');
  });

  it('keeps to canals a 14 m draft can use, like the demo', () => {
    expect(computeRoute('DEHAM', 'GRPIR').passages).not.toContain('corinth');
  });

  it('has no Suez alternative for a route that never uses Suez', () => {
    expect(computeRoute('USLAX', 'CNSHA').suezClosed).toBeUndefined();
  });

  it('reports ECA distance and a CO₂e estimate', () => {
    expect(r.ecaKm).toBeGreaterThan(0);
    expect(r.co2eTonnes).toBeGreaterThan(0);
  });
});

describe('renderRoutePage', () => {
  const html = lone(computeRoute('CNSHA', 'NLRTM'));

  it('has a unique title and description naming the distance and canal', () => {
    expect(html).toContain('<title>Shanghai to Rotterdam sea distance: 10,666 nm via Suez</title>');
    expect(html).toMatch(/<meta name="description" content="[^"]*10,666 nm[^"]*"/);
    expect(html).toContain('<h1>Shanghai to Rotterdam sea distance</h1>');
  });

  it('is canonical under the demo URL', () => {
    expect(html).toContain(
      '<link rel="canonical" href="https://mayurrawte.is-a.dev/searoute-ts/routes/CNSHA-NLRTM/" />',
    );
  });

  it('links to the interactive demo with the route pre-filled', () => {
    expect(html).toContain('href="../../?from=CNSHA&amp;to=NLRTM"');
  });

  it('shows the code for the route', () => {
    expect(html).toContain('seaRoute(&#39;CNSHA&#39;, &#39;NLRTM&#39;, { vesselDraftMeters: 14 })');
  });

  it('shows the Suez-closed alternative', () => {
    expect(html).toMatch(/Suez closed<\/h2>[^]*13,669 nm/);
  });

  it('carries schema.org data that parses', () => {
    const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
    const data = JSON.parse(json);
    expect(data['@graph'].map((n) => n['@type'])).toEqual(['WebPage', 'FAQPage']);
  });

  it('needs no script to read', () => {
    expect(html.replace(/<script type="application\/ld\+json">.*?<\/script>/s, '')).not.toContain('<script');
  });
});

describe('renderSitemap', () => {
  const xml = renderSitemap([SITE, routeUrl('CNSHA-NLRTM'), routeUrl('NLRTM-CNSHA')]);

  it('lists every URL once', () => {
    expect(xml.match(/<loc>/g)).toHaveLength(3);
    expect(xml).toContain('<loc>https://mayurrawte.is-a.dev/searoute-ts/routes/CNSHA-NLRTM/</loc>');
  });

  it('is a sitemaps.org urlset', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trim().endsWith('</urlset>')).toBe(true);
  });
});

describe('page meta', () => {
  const pages = {
    'the demo': readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
    'a route page': lone(computeRoute('SGSIN', 'NLRTM')),
    'a port page': renderPortPage('SGSIN', [computeRoute('SGSIN', 'NLRTM')]),
    'the route index': renderRoutesIndex([computeRoute('SGSIN', 'NLRTM')]),
  };

  for (const [name, html] of Object.entries(pages)) {
    it(`${name} has canonical, Open Graph and Twitter card tags`, () => {
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      expect(canonical?.startsWith(SITE)).toBe(true);
      expect(html).toContain(`<meta property="og:url" content="${canonical}" />`);
      for (const p of ['og:type', 'og:title', 'og:description', 'og:site_name']) {
        expect(html).toMatch(new RegExp(`<meta\\s+property="${p}"\\s+content="[^"]+"`));
      }
      expect(html).toContain(`<meta property="og:image" content="${SITE}og.png" />`);
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    });
  }

  it('titles the route card after the route', () => {
    expect(pages['a route page']).toContain(
      '<meta property="og:title" content="Singapore to Rotterdam sea distance: 8,439 nm via Suez" />',
    );
  });
});

describe('internal links', () => {
  const routes = [
    ['CNSHA', 'NLRTM'],
    ['NLRTM', 'CNSHA'],
    ['CNSHA', 'SGSIN'],
    ['SGSIN', 'NLRTM'],
    ['CNSHA', 'DEHAM'],
  ].map(([a, b]) => computeRoute(a, b));
  const [shaRtm, rtmSha, shaSin, sinRtm, shaHam] = routes;
  const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

  describe('relatedRoutes', () => {
    const related = relatedRoutes(shaRtm, routes);

    it('finds the reverse direction', () => {
      expect(related.reverse).toBe(rtmSha);
    });

    it('lists other routes from the same origin, shortest first', () => {
      expect(related.fromSame).toEqual([shaSin, shaHam]);
    });

    it('lists other routes to the same destination', () => {
      expect(related.toSame).toEqual([sinRtm]);
    });

    it('caps each list', () => {
      expect(relatedRoutes(shaRtm, routes, 1).fromSame).toEqual([shaSin]);
    });
  });

  it('links a route page to its reverse, its neighbours and both port pages', () => {
    const links = hrefs(renderRoutePage(shaRtm, relatedRoutes(shaRtm, routes)));
    expect(links).toEqual(
      expect.arrayContaining([
        '../NLRTM-CNSHA/',
        '../CNSHA-SGSIN/',
        '../SGSIN-NLRTM/',
        '../../ports/CNSHA/',
        '../../ports/NLRTM/',
        '../',
      ]),
    );
  });

  describe('renderPortPage', () => {
    const html = renderPortPage('CNSHA', routes);

    it('names the port, its country and UN/LOCODE', () => {
      expect(html).toContain('<h1>Shanghai sea routes</h1>');
      expect(html).toContain('China');
      expect(html).toContain('CNSHA');
      expect(html).toContain(`<link rel="canonical" href="${SITE}ports/CNSHA/" />`);
    });

    it('lists every route from or to the port, with its distance', () => {
      const links = hrefs(html);
      for (const r of [shaRtm, rtmSha, shaSin, shaHam]) {
        expect(links).toContain(`../../routes/${r.slug}/`);
      }
      expect(links).not.toContain('../../routes/SGSIN-NLRTM/');
      expect(html).toContain('10,666 nm');
    });
  });

  describe('renderRoutesIndex', () => {
    const html = renderRoutesIndex(routes);

    it('links every route page directly and every port page', () => {
      const links = hrefs(html);
      for (const r of routes) expect(links).toContain(`${r.slug}/`);
      for (const code of ['CNSHA', 'NLRTM', 'SGSIN']) expect(links).toContain(`../ports/${code}/`);
    });

    it('is canonical at /routes/', () => {
      expect(html).toContain(`<link rel="canonical" href="${SITE}routes/" />`);
    });
  });

  it('puts the index, every port page and every route page in the sitemap', () => {
    const urls = siteUrls(routes);
    expect(urls).toEqual(
      expect.arrayContaining([SITE, `${SITE}routes/`, portUrl('DEHAM'), routeUrl('CNSHA-DEHAM')]),
    );
    expect(urls).toHaveLength(2 + 4 + routes.length);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
