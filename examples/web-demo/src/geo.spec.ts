import { describe, expect, it } from 'vitest';

import { type LngLat, unwrapLine } from './geo.js';

describe('unwrapLine', () => {
  it('returns an empty array for empty input', () => {
    expect(unwrapLine([])).toEqual([]);
  });

  it('leaves lines that never cross the antimeridian untouched', () => {
    const line: LngLat[] = [
      [139.6, 35.4],
      [150.0, 37.0],
      [170.0, 40.0],
    ];
    expect(unwrapLine(line)).toEqual(line);
  });

  it('unwraps an eastward crossing so the line stays continuous', () => {
    expect(
      unwrapLine([
        [170, 40],
        [-175, 42],
      ]),
    ).toEqual([
      [170, 40],
      [185, 42],
    ]);
  });

  it('unwraps a westward crossing so the line stays continuous', () => {
    expect(
      unwrapLine([
        [-170, 40],
        [175, 42],
      ]),
    ).toEqual([
      [-170, 40],
      [-185, 42],
    ]);
  });

  it('keeps every consecutive longitude delta under 180° on a transpacific line', () => {
    // Shape of a Yokohama → LA route as the library returns it: wrapped to
    // [-180, 180], jumping from +179.x to -179.x mid-Pacific.
    const line: LngLat[] = [
      [139.6, 35.4],
      [160.0, 42.0],
      [179.5, 45.0],
      [-179.5, 45.2],
      [-150.0, 40.0],
      [-118.3, 33.7],
    ];
    const out = unwrapLine(line);
    for (let i = 1; i < out.length; i++) {
      expect(Math.abs(out[i][0] - out[i - 1][0])).toBeLessThan(180);
    }
    // Latitudes and point count must be preserved.
    expect(out.map((c) => c[1])).toEqual(line.map((c) => c[1]));
    expect(out).toHaveLength(line.length);
  });

  it('accumulates the offset across the rest of the line after a crossing', () => {
    const out = unwrapLine([
      [178, 10],
      [-178, 11],
      [-160, 12],
    ]);
    expect(out).toEqual([
      [178, 10],
      [182, 11],
      [200, 12],
    ]);
  });

  it('does not mutate its input', () => {
    const line: LngLat[] = [
      [179, 0],
      [-179, 1],
    ];
    unwrapLine(line);
    expect(line).toEqual([
      [179, 0],
      [-179, 1],
    ]);
  });
});
