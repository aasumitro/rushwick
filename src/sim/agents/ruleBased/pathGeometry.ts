import { clamp, type Vec2 } from '../../core/vec2';

/** The route ahead in the ego frame with cumulative arc length. */
export interface LocalPath {
  points: readonly Vec2[];
  cum: number[];
  length: number;
}

export function buildLocalPath(points: readonly Vec2[]): LocalPath {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { points, cum, length: cum[cum.length - 1]! };
}

/** Signed curvature (left positive) of the circle through three points. */
export function menger(a: Vec2, b: Vec2, c: Vec2): number {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ca = Math.hypot(a.x - c.x, a.y - c.y);
  const area2 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const denom = ab * bc * ca;
  return denom > 1e-9 ? (2 * area2) / denom : 0;
}

/** Point at arc length `s` (clamped to the path). */
export function pointAt(path: LocalPath, s: number): Vec2 {
  const p = path.points;
  const sc = clamp(s, 0, path.length);
  let i = 1;
  while (i < p.length - 1 && path.cum[i]! < sc) i++;
  const a = p[i - 1]!;
  const b = p[i]!;
  const seg = path.cum[i]! - path.cum[i - 1]!;
  const t = seg > 1e-9 ? (sc - path.cum[i - 1]!) / seg : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Signed curvature around arc length `s`, measured over +-`baseline` metres. */
export function curvatureAt(path: LocalPath, s: number, baseline = 1): number {
  if (path.points.length < 2 || path.length < 2 * baseline) return 0;
  const mid = clamp(s, baseline, path.length - baseline);
  return menger(pointAt(path, mid - baseline), pointAt(path, mid), pointAt(path, mid + baseline));
}

export interface PathProjection {
  s: number;
  lateral: number;
  heading: number;
}

/** Closest point on the path to (px, py): arc length, signed lateral offset and tangent. */
export function projectOnPath(path: LocalPath, px: number, py: number): PathProjection {
  let best = { s: -1, lateral: Infinity, heading: 0, d: Infinity };
  const p = path.points;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const l2 = abx * abx + aby * aby;
    if (l2 < 1e-9) continue;
    const t = clamp(((px - a.x) * abx + (py - a.y) * aby) / l2, 0, 1);
    const d = Math.hypot(px - (a.x + abx * t), py - (a.y + aby * t));
    if (d < best.d) {
      const l = Math.sqrt(l2);
      best = { s: path.cum[i - 1]! + t * l, lateral: (abx * (py - a.y) - aby * (px - a.x)) / l, heading: Math.atan2(aby, abx), d };
    }
  }
  return best;
}
