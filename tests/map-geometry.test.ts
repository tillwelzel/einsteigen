import { describe, expect, it } from 'vitest';
import {
  sliceMultiLegPolylines,
  smoothPolyline,
  type LngLat,
} from '../src/utils/map-geometry';

describe('smoothPolyline', () => {
  it('returns input unchanged when fewer than 3 points', () => {
    const two: LngLat[] = [
      [11.57, 48.13],
      [11.58, 48.14],
    ];
    expect(smoothPolyline(two)).toEqual(two);
    expect(smoothPolyline([[11.57, 48.13]])).toEqual([[11.57, 48.13]]);
  });

  it('passes *exactly* through every original station coordinate', () => {
    const stations: LngLat[] = [
      [11.54, 48.14],
      [11.56, 48.14],
      [11.575, 48.137],
      [11.59, 48.125],
      [11.61, 48.128],
    ];
    const smoothed = smoothPolyline(stations, { subdivisions: 10 });

    expect(smoothed.length).toBe((stations.length - 1) * 10 + 1);
    for (let i = 0; i < stations.length; i++) {
      expect(smoothed[i * 10]).toEqual(stations[i]);
    }
  });

  it('curves smoothly around corners without wild overshoot', () => {
    const corner: LngLat[] = [
      [11.55, 48.14],
      [11.57, 48.14],
      [11.57, 48.12],
    ];
    const smoothed = smoothPolyline(corner, { subdivisions: 12 });

    // Passes exactly through the corner station
    expect(smoothed[12]).toEqual(corner[1]);

    // Curves gently rather than remaining a rigid straight line
    const midFirst = smoothed[6];
    expect(midFirst[1]).toBeGreaterThan(48.14);
    expect(midFirst[1]).toBeLessThan(48.144);

    // Stays within a tight envelope around the control points
    for (const [lon, lat] of smoothed) {
      expect(lon).toBeGreaterThan(11.548);
      expect(lon).toBeLessThan(11.574);
      expect(lat).toBeGreaterThan(48.118);
      expect(lat).toBeLessThan(48.144);
    }
  });

  it('deduplicates consecutive identical points cleanly', () => {
    const withDupes: LngLat[] = [
      [11.55, 48.14],
      [11.55, 48.14],
      [11.56, 48.14],
      [11.57, 48.13],
    ];
    const smoothed = smoothPolyline(withDupes);
    expect(smoothed[0]).toEqual([11.55, 48.14]);
    expect(smoothed[smoothed.length - 1]).toEqual([11.57, 48.13]);
    expect(
      smoothed.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)),
    ).toBe(true);
  });
});

describe('sliceMultiLegPolylines', () => {
  const leg1: LngLat[] = [
    [11.5, 48.14],
    [11.6, 48.14],
  ];
  const leg2: LngLat[] = [
    [11.6, 48.14],
    [11.7, 48.14],
  ];

  it('returns empty arrays at progress 0 and full legs at progress 1', () => {
    expect(sliceMultiLegPolylines([leg1, leg2], 0)).toEqual([[], []]);
    expect(sliceMultiLegPolylines([leg1, leg2], 1)).toEqual([leg1, leg2]);
  });

  it('progresses continuously from leg 1 into leg 2', () => {
    const quarter = sliceMultiLegPolylines([leg1, leg2], 0.25);
    expect(quarter[0].length).toBe(2);
    expect(quarter[0][0]).toEqual([11.5, 48.14]);
    expect(quarter[0][1][0]).toBeCloseTo(11.55, 5);
    expect(quarter[1]).toEqual([]);

    const threeQuarters = sliceMultiLegPolylines([leg1, leg2], 0.75);
    expect(threeQuarters[0]).toEqual(leg1);
    expect(threeQuarters[1].length).toBe(2);
    expect(threeQuarters[1][0]).toEqual([11.6, 48.14]);
    expect(threeQuarters[1][1][0]).toBeCloseTo(11.65, 5);
  });
});
