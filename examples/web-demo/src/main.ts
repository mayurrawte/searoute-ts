import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl';
import {
  NoRouteError,
  type Passage,
  seaRoute,
  type SeaRouteFeature,
  SnapFailedError,
} from 'searoute-ts';

import { type LngLat, unwrapLine } from './geo.js';
import { findPort, portLabel, type PortOption, searchPorts } from './ports.js';
import { PRESETS, type Preset } from './presets.js';
import { fmtCoord, type Place, readUrl, writeUrl, type UrlState } from './url-state.js';
import './style.css';

const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// OpenStreetMap raster tiles — the Carto basemaps started rejecting
// cross-origin requests without an API key (issue #4).
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    basemap: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'basemap',
      type: 'raster' as const,
      source: 'basemap',
      // OSM only ships a light style; dim it a little when the UI is dark.
      paint: isDark ? { 'raster-brightness-max': 0.8, 'raster-saturation': -0.25 } : {},
    },
  ],
};

const map = new maplibregl.Map({
  container: 'map',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style: MAP_STYLE as any,
  center: [0, 20],
  zoom: 1.6,
  attributionControl: false,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

// ── State ───────────────────────────────────────────────────────────────────

const state: UrlState = readUrl();
let originMarker: maplibregl.Marker | undefined;
let destMarker: maplibregl.Marker | undefined;
let currentRoute: SeaRouteFeature | undefined;

// ── DOM ─────────────────────────────────────────────────────────────────────

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const originInput = $<HTMLInputElement>('#origin');
const destInput = $<HTMLInputElement>('#destination');
const speedInput = $<HTMLInputElement>('#speed');
const draftInput = $<HTMLInputElement>('#draft');
const resultsEl = $<HTMLElement>('#results');
const codeCard = $<HTMLElement>('#code-card');
const codeSnippet = $<HTMLPreElement>('#code-snippet');
const hint = $<HTMLElement>('#hint');
const presetButtons = $<HTMLElement>('#preset-buttons');
const restrictionToggles = document.querySelectorAll<HTMLInputElement>('[data-restrict]');
const arcticToggle = document.querySelector<HTMLInputElement>('[data-allow-arctic]')!;

// Populate presets
for (const p of PRESETS) {
  const btn = document.createElement('button');
  btn.className = 'preset-btn';
  btn.textContent = p.label;
  btn.addEventListener('click', () => applyPreset(p));
  presetButtons.appendChild(btn);
}

// Initial UI sync from URL
speedInput.value = String(state.speedKnots);
draftInput.value = String(state.draftMeters);
arcticToggle.checked = state.allowArctic;
for (const cb of restrictionToggles) {
  const r = cb.dataset.restrict as Passage;
  cb.checked = state.restrictions.includes(r);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function setPin(side: 'origin' | 'destination', place: Place) {
  const el = document.createElement('div');
  el.className = `pin ${side}`;
  el.textContent = side === 'origin' ? 'A' : 'B';

  const marker = new maplibregl.Marker({ element: el, draggable: true })
    .setLngLat(place.coord)
    .addTo(map);
  marker.on('dragend', () => {
    const ll = marker.getLngLat();
    // Dragged off the port, so the code no longer describes this point.
    const dragged: Place = { coord: [+ll.lng.toFixed(5), +ll.lat.toFixed(5)] };
    if (side === 'origin') state.origin = dragged;
    else state.destination = dragged;
    updateInputs();
    recompute();
  });

  if (side === 'origin') {
    originMarker?.remove();
    originMarker = marker;
    state.origin = place;
  } else {
    destMarker?.remove();
    destMarker = marker;
    state.destination = place;
  }
  updateInputs();
}

function placeLabel(p: Place): string {
  if (!p.code) return fmtCoord(p.coord);
  const port = findPort(p.code);
  return port ? portLabel(port) : p.code;
}

function updateInputs() {
  originInput.value = state.origin ? placeLabel(state.origin) : '';
  destInput.value = state.destination ? placeLabel(state.destination) : '';
  updateHint();
}

function updateHint() {
  if (!state.origin) {
    hint.innerHTML = 'Click the map to set <strong>A</strong> (origin)';
    hint.classList.remove('hidden');
  } else if (!state.destination) {
    hint.innerHTML = 'Click again to set <strong>B</strong> (destination)';
    hint.classList.remove('hidden');
  } else {
    hint.classList.add('hidden');
  }
}

function applyPreset(p: Preset) {
  setPin('origin', { coord: p.origin });
  setPin('destination', { coord: p.destination });
  recompute();
  fitToCoords([p.origin, p.destination]);
}

function fitToCoords(coords: [number, number][]) {
  if (coords.length === 0) return;
  const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
  for (const c of coords) bounds.extend(c);
  map.fitBounds(bounds.toArray() as LngLatBoundsLike, { padding: 80, duration: 600 });
}

function readRestrictions(): Passage[] {
  const out: Passage[] = [];
  for (const cb of restrictionToggles) {
    if (cb.checked) out.push(cb.dataset.restrict as Passage);
  }
  return out;
}

// ── Port picker ─────────────────────────────────────────────────────────────

function attachPortPicker(side: 'origin' | 'destination', input: HTMLInputElement) {
  const list = $<HTMLUListElement>(`#${side}-options`);
  let options: PortOption[] = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    options = [];
    active = -1;
  };

  const highlight = () => {
    for (const [i, li] of [...list.children].entries()) {
      li.setAttribute('aria-selected', String(i === active));
    }
  };

  const choose = (port: PortOption) => {
    close();
    setPin(side, { coord: port.coordinates, code: port.code });
    recompute();
    const other = side === 'origin' ? state.destination : state.origin;
    fitToCoords(other ? [port.coordinates, other.coord] : [port.coordinates]);
  };

  const open = (query: string) => {
    options = searchPorts(query);
    if (options.length === 0) return close();
    list.replaceChildren(
      ...options.map((port, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === active));
        li.append(`${port.name}, ${port.country} `);
        const code = document.createElement('span');
        code.className = 'port-code';
        code.textContent = port.code;
        li.appendChild(code);
        li.addEventListener('mousedown', (e) => {
          e.preventDefault(); // keep focus so the input's blur doesn't race the click
          choose(port);
        });
        return li;
      }),
    );
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  input.addEventListener('input', () => {
    active = -1;
    open(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (options.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      highlight();
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(options[active === -1 ? 0 : active]);
    }
  });

  // Leaving the field abandons a half-typed query; show the pin again.
  input.addEventListener('blur', () => {
    close();
    updateInputs();
  });
}

attachPortPicker('origin', originInput);
attachPortPicker('destination', destInput);

// ── Compute & render ────────────────────────────────────────────────────────

function recompute() {
  if (!state.origin || !state.destination) {
    drawRoute(undefined);
    return;
  }

  state.speedKnots = Number(speedInput.value) || 22;
  state.draftMeters = Number(draftInput.value) || 0;
  state.allowArctic = arcticToggle.checked;
  state.restrictions = readRestrictions();
  writeUrl(state);

  try {
    const route = seaRoute(state.origin.coord, state.destination.coord, {
      units: 'kilometers',
      restrictions: state.restrictions,
      allowArctic: state.allowArctic,
      vesselDraftMeters: state.draftMeters > 0 ? state.draftMeters : undefined,
      speedKnots: state.speedKnots,
      returnPassages: true,
    });
    currentRoute = route;
    drawRoute(route);
    renderResults(route, null);
  } catch (err) {
    currentRoute = undefined;
    drawRoute(undefined);
    renderResults(null, err as Error);
  }
}

function drawRoute(route: SeaRouteFeature | undefined) {
  const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
  // Unwrap across the antimeridian so Pacific routes don't render as a
  // straight line through the map seam (issue #5).
  const coords = route ? unwrapLine(route.geometry.coordinates as LngLat[]) : [];
  const data = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: route?.properties ?? {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  if (src) {
    src.setData(data);
  } else if (route) {
    map.addSource('route', { type: 'geojson', data });
    map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#38bdf8',
        'line-width': 8,
        'line-blur': 5,
        'line-opacity': 0.35,
      },
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#0ea5e9',
        'line-width': 3,
        'line-opacity': 0.95,
      },
    });
  }

  if (coords.length > 1) {
    fitToCoords(coords);
  }
}

const KM_TO_NM = 1 / 1.852;
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function renderResults(route: SeaRouteFeature | null, err: Error | null) {
  if (err) {
    const msg = err instanceof SnapFailedError
      ? `Couldn't snap ${err.side} to the network (nearest is ${err.distanceKm.toFixed(0)} km away).`
      : err instanceof NoRouteError
      ? 'No route found with these restrictions — try fewer blocked canals.'
      : err.message;
    resultsEl.innerHTML = `<h2>Result</h2><div class="error-box">${escapeHtml(msg)}</div>`;
    codeCard.hidden = true;
    return;
  }

  if (!route) {
    resultsEl.innerHTML =
      '<h2>Result</h2><p class="hint">Click any two points on the map, or pick a preset, to compute a route.</p>';
    codeCard.hidden = true;
    return;
  }

  const p = route.properties;
  const km = p.length;
  const nm = km * KM_TO_NM;
  const dur = p.durationHours ?? 0;
  const days = dur / 24;

  resultsEl.innerHTML = `
    <h2>Result</h2>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Distance</div><div class="stat-value">${fmt(km)} km</div><div class="stat-label">${fmt(nm)} nm</div></div>
      <div class="stat"><div class="stat-label">Duration @ ${state.speedKnots} kn</div><div class="stat-value">${dur.toFixed(0)} h</div><div class="stat-label">${days.toFixed(1)} days</div></div>
      <div class="stat"><div class="stat-label">Great-circle</div><div class="stat-value">${fmt(p.greatCircleLength)} km</div><div class="stat-label">detour ${p.detourRatio.toFixed(2)}×</div></div>
      <div class="stat"><div class="stat-label">Snap to network</div><div class="stat-value">${p.originSnapKm.toFixed(0)} / ${p.destinationSnapKm.toFixed(0)} km</div><div class="stat-label">origin / dest</div></div>
    </div>
    <div class="passages">
      ${(p.passages ?? []).map((x) => `<span class="passage-pill">${x}</span>`).join('')}
    </div>
  `;
  codeCard.hidden = false;
  codeSnippet.textContent = generateCode();
}

function generateCode(): string {
  const o = state.origin!;
  const d = state.destination!;
  const opts: string[] = [`  units: 'kilometers',`];
  if (state.restrictions.length) {
    opts.push(`  restrictions: [${state.restrictions.map((r) => `'${r}'`).join(', ')}],`);
  }
  if (state.allowArctic) opts.push(`  allowArctic: true,`);
  if (state.draftMeters > 0) opts.push(`  vesselDraftMeters: ${state.draftMeters},`);
  if (state.speedKnots > 0) opts.push(`  speedKnots: ${state.speedKnots},`);
  opts.push(`  returnPassages: true,`);
  // Both endpoints are ports — show the UN/LOCODE form, which needs the
  // `searoute-ts/ports` import to register the code resolver.
  const byCode = o.code && d.code;
  const imports = byCode
    ? `import { seaRoute } from 'searoute-ts';\nimport 'searoute-ts/ports';`
    : `import { seaRoute } from 'searoute-ts';`;
  const args = byCode
    ? `  '${o.code}',\n  '${d.code}',`
    : `  [${o.coord[0]}, ${o.coord[1]}],\n  [${d.coord[0]}, ${d.coord[1]}],`;
  return `${imports}

const route = seaRoute(
${args}
  {
${opts.join('\n')}
  }
);

console.log(route.properties.length); // km`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

// ── Map click handler ──────────────────────────────────────────────────────

map.on('click', (e) => {
  const c: Place = { coord: [+e.lngLat.lng.toFixed(5), +e.lngLat.lat.toFixed(5)] };
  if (!state.origin) {
    setPin('origin', c);
  } else if (!state.destination) {
    setPin('destination', c);
    recompute();
  } else {
    // Both set — start over from this click as new origin
    destMarker?.remove();
    destMarker = undefined;
    state.destination = undefined;
    setPin('origin', c);
    drawRoute(undefined);
    renderResults(null, null);
    writeUrl(state);
  }
});

// ── Wiring ─────────────────────────────────────────────────────────────────

for (const cb of restrictionToggles) cb.addEventListener('change', recompute);
arcticToggle.addEventListener('change', recompute);
speedInput.addEventListener('change', recompute);
draftInput.addEventListener('change', recompute);

$<HTMLButtonElement>('#reset').addEventListener('click', () => {
  originMarker?.remove();
  destMarker?.remove();
  originMarker = destMarker = undefined;
  state.origin = state.destination = undefined;
  drawRoute(undefined);
  renderResults(null, null);
  updateInputs();
  writeUrl(state);
});

$<HTMLButtonElement>('#swap').addEventListener('click', () => {
  if (!state.origin || !state.destination) return;
  const o = state.origin;
  const d = state.destination;
  originMarker?.remove();
  destMarker?.remove();
  setPin('origin', d);
  setPin('destination', o);
  recompute();
});

$<HTMLButtonElement>('#share').addEventListener('click', async () => {
  const url = writeUrl(state);
  try {
    await navigator.clipboard.writeText(url);
    const btn = $<HTMLButtonElement>('#share');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = orig), 1500);
  } catch {
    prompt('Copy this URL:', url);
  }
});

// ── Initial state ───────────────────────────────────────────────────────────

map.on('load', () => {
  if (state.origin) setPin('origin', state.origin);
  if (state.destination) setPin('destination', state.destination);
  if (state.origin && state.destination) {
    fitToCoords([state.origin.coord, state.destination.coord]);
    recompute();
  } else {
    updateHint();
  }
});

// Silence unused — currentRoute is kept for future features.
void currentRoute;
