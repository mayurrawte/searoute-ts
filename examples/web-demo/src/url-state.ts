import type { Passage } from 'searoute-ts';

export type UrlState = {
  origin?: [number, number];
  destination?: [number, number];
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

function parseCoord(s: string | null): [number, number] | undefined {
  if (!s) return undefined;
  const parts = s.split(',').map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return undefined;
  return [parts[0], parts[1]];
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
  const origin = parseCoord(u.searchParams.get('from'));
  const destination = parseCoord(u.searchParams.get('to'));
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
  if (s.origin) u.searchParams.set('from', s.origin.join(','));
  if (s.destination) u.searchParams.set('to', s.destination.join(','));
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
