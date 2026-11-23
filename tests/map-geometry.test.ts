import { describe, expect, it } from 'vitest';
import { smoothPolyline, type LngLat } from '../src/utils/map-geometry';

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
