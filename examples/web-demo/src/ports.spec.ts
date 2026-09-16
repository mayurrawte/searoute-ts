import { describe, expect, it } from 'vitest';

import { findPort, portLabel, searchPorts } from './ports.js';

describe('searchPorts', () => {
  it('returns nothing for a blank query', () => {
    expect(searchPorts('')).toEqual([]);
    expect(searchPorts('   ')).toEqual([]);
  });

  it('returns nothing when nothing matches', () => {
    expect(searchPorts('qqzzxx')).toEqual([]);
  });

  it('finds a port by UN/LOCODE, case-insensitively', () => {
    expect(searchPorts('cnsha')[0]).toEqual({
      code: 'CNSHA',
      name: 'Shanghai',
      country: 'China',
      coordinates: [121.473701, 31.230416],
    });
  });

  it('finds a port by name', () => {
    expect(searchPorts('rotterdam').map((p) => p.code)).toContain('NLRTM');
  });

  it('finds a port by country', () => {
    expect(searchPorts('netherlands', 100).map((p) => p.code)).toContain('NLRTM');
  });

  it('ranks an exact code match first', () => {
    expect(searchPorts('NLRTM')[0].code).toBe('NLRTM');
  });

  it('ranks a name that starts with the query above one that merely contains it', () => {
    const first = searchPorts('port')[0];
    expect(first.name.toLowerCase().startsWith('port')).toBe(true);
  });

  it('caps the number of results at the limit', () => {
    expect(searchPorts('port', 5)).toHaveLength(5);
  });
});

describe('findPort', () => {
  it('resolves a UN/LOCODE, case-insensitively', () => {
    expect(findPort('cnsha')).toEqual({
      code: 'CNSHA',
      name: 'Shanghai',
      country: 'China',
      coordinates: [121.473701, 31.230416],
    });
  });

  it('is undefined for an unknown code', () => {
    expect(findPort('ZZZZZ')).toBeUndefined();
  });
});

describe('portLabel', () => {
  it('reads as name, country and code', () => {
    expect(
      portLabel({
        code: 'CNSHA',
        name: 'Shanghai',
        country: 'China',
        coordinates: [121.473701, 31.230416],
      }),
    ).toBe('Shanghai, China (CNSHA)');
  });
});
