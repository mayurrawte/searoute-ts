import { lookupPort, PORTS, type PortRecord } from 'searoute-ts/ports';

export type PortOption = PortRecord & { code: string };

const ENTRIES: PortOption[] = Object.entries(PORTS).map(([code, record]) => ({ code, ...record }));

// Higher wins. Alias codes (CNSGH and CNSHA are both Shanghai) are all kept —
// they are equally valid UN/LOCODEs and the dataset marks no canonical one.
function rank(port: PortOption, q: string): number {
  const code = port.code.toLowerCase();
  if (code === q) return 5;
  if (code.startsWith(q)) return 4;
  const name = port.name.toLowerCase();
  if (name.startsWith(q)) return 3;
  if (name.includes(q)) return 2;
  if (port.country.toLowerCase().includes(q)) return 1;
  return 0;
}

export function searchPorts(query: string, limit = 8): PortOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ENTRIES.map((port) => ({ port, r: rank(port, q) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r || a.port.name.localeCompare(b.port.name))
    .slice(0, limit)
    .map((x) => x.port);
}

export function findPort(code: string): PortOption | undefined {
  return lookupPort(code);
}

export function portLabel(port: PortOption): string {
  return `${port.name}, ${port.country} (${port.code})`;
}
