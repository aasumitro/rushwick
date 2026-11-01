import { clamp, cross, sub, type Vec2 } from './vec2';

export interface Aabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const aabbContains = (b: Aabb, x: number, y: number): boolean =>
  x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;

export function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const l2 = abx * abx + aby * aby;
  const t = l2 > 1e-12 ? clamp(((px - ax) * abx + (py - ay) * aby) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(sub(b, a), sub(c, a));
  const d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c));
  const d4 = cross(sub(d, c), sub(b, c));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Minimum distance between segments ab and cd. */
export function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a.x, a.y, c.x, c.y, d.x, d.y),
    pointSegmentDistance(b.x, b.y, c.x, c.y, d.x, d.y),
    pointSegmentDistance(c.x, c.y, a.x, a.y, b.x, b.y),
    pointSegmentDistance(d.x, d.y, a.x, a.y, b.x, b.y),
  );
}

/** Closest point to p on segment ab, with the parameter clamped to [tMin, tMax]. */
export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2, tMin = 0, tMax = 1): Vec2 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  const t = l2 > 0 ? clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, tMin, tMax) : 0;
  return { x: a.x + abx * t, y: a.y + aby * t };
}
