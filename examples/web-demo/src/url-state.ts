import type { Passage } from 'searoute-ts';
import { lookupPort } from 'searoute-ts/ports';

/** An endpoint: always a coordinate, plus the port code it came from, if any. */
export type Place = { coord: [number, number]; code?: string };

export type UrlState = {
  origin?: Place;
  destination?: Place;
  restrictions: Passage[];
  allowArctic: boolean;
  speedKnots: number;
  draftMeters: number;
};

const DEFAULT_STATE: UrlState = {
  restrictions: [],
  allowArctic: false,
  speedKnots: 22,
  draftMeters: 14,
};

function parseCoord(s: string): [number, number] | undefined {
  const parts = s.split(',');
  if (parts.length !== 2 || parts.some((p) => p.trim() === '')) return undefined;
  const [lon, lat] = parts.map(Number);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined;
  return [lon, lat];
}

/** `from`/`to` carry either a UN/LOCODE (`CNSHA`) or a bare `lon,lat` pair. */
export function parsePlace(raw: string | null): Place | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  if (s.includes(',')) {
    const coord = parseCoord(s);
    return coord && { coord };
  }
  const port = lookupPort(s);
  return port && { coord: port.coordinates, code: port.code };
}

export function formatPlace(p: Place): string {
  return p.code ?? p.coord.join(',');
}

const KNOWN_PASSAGES: Passage[] = [
  'suez',
  'panama',
  'gibraltar',
  'babelmandeb',
  'babalmandab',
  'bosporus',
  'ormuz',
  'malacca',
  'sunda',
  'dover',
  'kiel',
  'corinth',
  'bering',
  'magellan',
  'cape_horn',
  'northwest',
  'northeast',
];

export function readUrl(): UrlState {
  const u = new URL(window.location.href);
  const origin = parsePlace(u.searchParams.get('from'));
  const destination = parsePlace(u.searchParams.get('to'));
  const restrictionsRaw = (u.searchParams.get('restrict') ?? '')
    .split(',')
    .filter(Boolean) as Passage[];
  const restrictions = restrictionsRaw.filter((r) => KNOWN_PASSAGES.includes(r));
  const allowArctic = u.searchParams.get('arctic') === '1';
  const speedKnots = Number(u.searchParams.get('speed')) || DEFAULT_STATE.speedKnots;
  const draftMeters = Number(u.searchParams.get('draft')) || DEFAULT_STATE.draftMeters;
  return {
    ...DEFAULT_STATE,
    origin,
    destination,
    restrictions,
    allowArctic,
    speedKnots,
    draftMeters,
  };
}

export function writeUrl(s: UrlState): string {
  const u = new URL(window.location.href);
  u.search = '';
  if (s.origin) u.searchParams.set('from', formatPlace(s.origin));
  if (s.destination) u.searchParams.set('to', formatPlace(s.destination));
  if (s.restrictions.length) u.searchParams.set('restrict', s.restrictions.join(','));
  if (s.allowArctic) u.searchParams.set('arctic', '1');
  if (s.speedKnots !== DEFAULT_STATE.speedKnots) u.searchParams.set('speed', String(s.speedKnots));
  if (s.draftMeters !== DEFAULT_STATE.draftMeters) u.searchParams.set('draft', String(s.draftMeters));
  window.history.replaceState(null, '', u.toString());
  return u.toString();
}

export function fmtCoord([lon, lat]: [number, number]): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}
