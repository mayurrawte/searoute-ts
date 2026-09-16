import { describe, expect, it } from 'vitest';

import { formatPlace, parsePlace } from './url-state.js';

describe('parsePlace', () => {
  it('is undefined when the parameter is absent or blank', () => {
    expect(parsePlace(null)).toBeUndefined();
    expect(parsePlace('')).toBeUndefined();
  });

  it('reads a lon,lat pair as a bare coordinate', () => {
    expect(parsePlace('121.5,31')).toEqual({ coord: [121.5, 31] });
  });

  it('reads a UN/LOCODE as a coordinate that remembers its port', () => {
    expect(parsePlace('CNSHA')).toEqual({
      coord: [121.473701, 31.230416],
      code: 'CNSHA',
    });
  });

  it('normalises a lower-case port code', () => {
    expect(parsePlace('cnsha')?.code).toBe('CNSHA');
  });

  it('is undefined for a code that is not a known port', () => {
    expect(parsePlace('ZZZZZ')).toBeUndefined();
  });

  it('is undefined for a half-written coordinate', () => {
    expect(parsePlace('121.5,')).toBeUndefined();
  });
});

describe('formatPlace', () => {
  it('writes a port as its code, so the link stays readable', () => {
    expect(formatPlace({ coord: [121.473701, 31.230416], code: 'CNSHA' })).toBe('CNSHA');
  });

  it('writes a dropped pin as lon,lat', () => {
    expect(formatPlace({ coord: [121.5, 31] })).toBe('121.5,31');
  });
});
