export type LngLat = [number, number];

export interface SmoothPolylineOptions {
  /** Number of interpolated sub-segments between each pair of stations. */
  subdivisions?: number;
  /** Spline tension in [0, 1]. 0 = classic centripetal Catmull-Rom, 1 = straight segments. */
  tension?: number;
}

/**
 * Smooths a geographic polyline using a latitude-compensated centripetal
 * Catmull-Rom spline (`alpha = 0.5`) with gentle tangent clamping:
 *  - Passes *exactly* through every original station coordinate (never misses a station).
 *  - Smooths angular corners into natural, flowing curves without loops or cusps.
 *  - Clamps tangent magnitudes to prevent overshoot across uneven suburban segments.
 */
export function smoothPolyline(
  coords: LngLat[],
  options: SmoothPolylineOptions = {},
): LngLat[] {
  const subdivisions = Math.max(2, options.subdivisions ?? 14);
  const tension = Math.max(0, Math.min(1, options.tension ?? 0.08));

  // Deduplicate adjacent identical coordinates
  const pts: LngLat[] = [];
  for (const c of coords) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(c[0] - prev[0], c[1] - prev[1]) > 1e-9) {
      pts.push(c);
    }
  }

  if (pts.length < 3) {
    return pts;
  }

  // Compensate for latitude compression (~48.14°N in Munich) so curves are isotropic
  let latSum = 0;
  for (const p of pts) latSum += p[1];
  const cosLat = Math.cos(((latSum / pts.length) * Math.PI) / 180) || 1;

  const toPlane = (p: LngLat): [number, number] => [p[0] * cosLat, p[1]];
  const fromPlane = (x: number, y: number): LngLat => [x / cosLat, y];

  const planePts = pts.map(toPlane);
  const n = planePts.length;

  // Reflected phantom endpoints for natural, zero-hook curvature at terminals
  const ext: [number, number][] = [
    [
      2 * planePts[0][0] - planePts[1][0],
      2 * planePts[0][1] - planePts[1][1],
    ],
    ...planePts,
    [
      2 * planePts[n - 1][0] - planePts[n - 2][0],
      2 * planePts[n - 1][1] - planePts[n - 2][1],
    ],
  ];

  const tangentScale = 1 - tension;
  const result: LngLat[] = [pts[0]];

  for (let i = 0; i < n - 1; i++) {
    const p0 = ext[i];
    const p1 = ext[i + 1];
    const p2 = ext[i + 2];
    const p3 = ext[i + 3];

    const d01 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const d12 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const d23 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);

    if (d12 < 1e-9) continue;

    // Centripetal knot intervals (alpha = 0.5)
    const dt0 = Math.max(Math.sqrt(d01), 1e-6);
    const dt1 = Math.max(Math.sqrt(d12), 1e-6);
    const dt2 = Math.max(Math.sqrt(d23), 1e-6);

    let m1x =
      tangentScale *
      dt1 *
      ((p1[0] - p0[0]) / dt0 -
        (p2[0] - p0[0]) / (dt0 + dt1) +
        (p2[0] - p1[0]) / dt1);
    let m1y =
      tangentScale *
      dt1 *
      ((p1[1] - p0[1]) / dt0 -
        (p2[1] - p0[1]) / (dt0 + dt1) +
        (p2[1] - p1[1]) / dt1);

    let m2x =
      tangentScale *
      dt1 *
      ((p2[0] - p1[0]) / dt1 -
        (p3[0] - p1[0]) / (dt1 + dt2) +
        (p3[0] - p2[0]) / dt2);
    let m2y =
      tangentScale *
      dt1 *
      ((p2[1] - p1[1]) / dt1 -
        (p3[1] - p1[1]) / (dt1 + dt2) +
        (p3[1] - p2[1]) / dt2);

    // Clamp tangent magnitude while preserving direction (G1 smoothness, no wild overshoot)
    const maxMag = d12 * 0.9;
    const mag1 = Math.hypot(m1x, m1y);
    if (mag1 > maxMag) {
      const s = maxMag / mag1;
      m1x *= s;
      m1y *= s;
    }
    const mag2 = Math.hypot(m2x, m2y);
    if (mag2 > maxMag) {
      const s = maxMag / mag2;
      m2x *= s;
      m2y *= s;
    }

    for (let step = 1; step < subdivisions; step++) {
      const u = step / subdivisions;
      const u2 = u * u;
      const u3 = u2 * u;

      const h00 = 2 * u3 - 3 * u2 + 1;
      const h10 = u3 - 2 * u2 + u;
      const h01 = -2 * u3 + 3 * u2;
      const h11 = u3 - u2;

      result.push(
        fromPlane(
          h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x,
          h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y,
        ),
      );
    }

    // Preserve exact original station coordinate verbatim
    result.push(pts[i + 1]);
  }

  return result;
}
